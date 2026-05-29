// Drill Library — Web Component 04 (HANDOFFS/WEB/04-drill-library.md).
//
//   GET  /api/drills/catalog                 — free drills by tension / trap
//   GET  /api/drills/prescribed?student_id=  — red-zone-driven suggestions + resumable in-progress
//   POST /api/drills/start                   — pin a question set + create a drill_assignments row
//   GET  /api/drills/:drill_id               — drill detail + progress
//   POST /api/drills/:drill_id/complete      — aggregate attempts, compute mastery + red-zone snapshot
//
// Identity model mirrors routes/boot-camps.ts: start accepts an optional
// student_id (else mints a synthetic anonymous student); everything afterward is
// keyed by the drill's own assignment_id, which is the set_id the runner tags
// every attempt with. Progress is therefore aggregated by set_id ALONE — the
// id is globally unique, so this captures attempts whether routes/attempts.ts
// attributed them to a signed-in student (via Clerk) or to an anonymous row.
// A client student_id is only used to read that student's red-zone snapshot.
//
// SQL is MySQL 8 (see BARMATRIX/engineering/SCHEMA_MYSQL.sql): question sets are
// pinned as a JSON array, randomized with ORDER BY RAND(), trap tags matched
// with JSON_CONTAINS/JSON_TABLE. The db wrapper rewrites $1 -> ?.

import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getPool, type DbClient, type DbPool } from "../db.js";
import { kebabToTitle } from "../lib/format.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_DRILL_SIZE = 12;
export const MIN_DRILL_SIZE = 1;
export const MAX_DRILL_SIZE = 50;
export const MASTERY_THRESHOLD = 0.75;
const CATALOG_LIMIT = 50;
const MAX_SUGGESTED = 8;
const MAX_IN_PROGRESS = 20;

// Red-zone dimensions the engine actually tracks (derived from question columns
// by lib/redzones.ts). Only these carry a meaningful proficiency snapshot.
const TRACKED_COLUMNS = ["subject", "subtopic", "tension_point"] as const;
type TrackedColumn = (typeof TRACKED_COLUMNS)[number];

export type DrillKind = "tension" | "trap" | "prescribed_red_zone";

export interface NormalizedStartInput {
  kind: DrillKind;
  slug: string | null;
  red_zone_dimension: string | null;
  red_zone_tag: string | null;
  size: number;
  student_id: string | null;
}

export class DrillInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrillInputError";
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB in drills.test.ts)
// ---------------------------------------------------------------------------

export function masteryResult(
  correct: number,
  total: number,
  threshold: number = MASTERY_THRESHOLD,
): { mastered: boolean; ratio: number } {
  if (total <= 0) return { mastered: false, ratio: 0 };
  const ratio = correct / total;
  return { mastered: ratio >= threshold, ratio };
}

export function mapDimensionToColumn(
  dimension: string | null | undefined,
): TrackedColumn | null {
  if (dimension && (TRACKED_COLUMNS as readonly string[]).includes(dimension)) {
    return dimension as TrackedColumn;
  }
  return null;
}

/** Title-case a snake_case / kebab-case / spaced tag for display copy. */
export function humanizeTag(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function normalizeStartInput(raw: unknown): NormalizedStartInput {
  if (typeof raw !== "object" || raw === null) {
    throw new DrillInputError("body must be a JSON object");
  }
  const b = raw as Record<string, unknown>;

  const kind = b.kind;
  if (kind !== "tension" && kind !== "trap" && kind !== "prescribed_red_zone") {
    throw new DrillInputError(
      "kind must be one of: tension, trap, prescribed_red_zone",
    );
  }

  let size = DEFAULT_DRILL_SIZE;
  if (b.size !== undefined && b.size !== null) {
    const n = Number(b.size);
    if (!Number.isInteger(n)) {
      throw new DrillInputError("size must be an integer");
    }
    size = Math.min(MAX_DRILL_SIZE, Math.max(MIN_DRILL_SIZE, n));
  }

  let studentId: string | null = null;
  if (b.student_id !== undefined && b.student_id !== null && b.student_id !== "") {
    if (typeof b.student_id !== "string" || !UUID_RE.test(b.student_id)) {
      throw new DrillInputError("student_id must be a uuid");
    }
    studentId = b.student_id;
  }

  let slug: string | null = null;
  let redZoneDimension: string | null = null;
  let redZoneTag: string | null = null;

  if (kind === "tension" || kind === "trap") {
    if (typeof b.slug !== "string" || b.slug.trim() === "") {
      throw new DrillInputError(`slug is required for ${kind} drills`);
    }
    slug = b.slug.trim();
  } else {
    if (typeof b.red_zone_dimension !== "string" || b.red_zone_dimension.trim() === "") {
      throw new DrillInputError(
        "red_zone_dimension is required for prescribed_red_zone drills",
      );
    }
    if (typeof b.red_zone_tag !== "string" || b.red_zone_tag.trim() === "") {
      throw new DrillInputError(
        "red_zone_tag is required for prescribed_red_zone drills",
      );
    }
    redZoneDimension = b.red_zone_dimension.trim();
    redZoneTag = b.red_zone_tag.trim();
  }

  return {
    kind,
    slug,
    red_zone_dimension: redZoneDimension,
    red_zone_tag: redZoneTag,
    size,
    student_id: studentId,
  };
}

/** The (dimension, tag) a started drill maps onto for red-zone reporting. */
export function redZoneTargetFor(input: NormalizedStartInput): {
  dimension: string;
  tag: string;
} {
  if (input.kind === "tension") {
    return { dimension: "tension_point", tag: input.slug ?? "" };
  }
  if (input.kind === "trap") {
    return { dimension: "wrong_answer_architecture", tag: input.slug ?? "" };
  }
  return {
    dimension: input.red_zone_dimension ?? "",
    tag: input.red_zone_tag ?? "",
  };
}

export function reasonFor(input: NormalizedStartInput): string {
  return `${input.kind}_drill`;
}

export function drillNameFor(input: NormalizedStartInput): string {
  const { tag } = redZoneTargetFor(input);
  const label = humanizeTag(tag) || "Targeted";
  if (input.kind === "tension") return `${label} tension drill`;
  if (input.kind === "trap") return `${label} trap drill`;
  return `${label} repair drill`;
}

function parseJsonIdArray(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function isTruthy(value: number | boolean): boolean {
  return value === true || value === 1;
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface QuestionIdRow {
  question_id: string;
}
interface StudentIdRow {
  student_id: string;
}
interface CatalogRow {
  slug: string;
  question_count: number | string;
}
interface ZoneSuggestionRow {
  dimension: string;
  tag_value: string;
  proficiency_score: number | string;
  attempts_count: number;
  high_confidence_wrong_count: number;
  candidate_question_count: number | string;
}
interface InProgressRow {
  assignment_id: string;
  drill_slug: string | null;
  reason: string;
  red_zone_dimension: string | null;
  red_zone_tag: string | null;
  status: string;
  question_count: number | string | null;
  prescribed_at: Date | string;
}
interface AssignmentRow {
  assignment_id: string;
  student_id: string;
  drill_slug: string | null;
  reason: string;
  red_zone_dimension: string | null;
  red_zone_tag: string | null;
  question_ids: unknown;
  status: string;
  prescribed_at?: Date | string;
  completed_at?: Date | string | null;
}
interface AttemptRow {
  question_id: string;
  correct: number | boolean;
}
interface RedZoneRow {
  proficiency_score: number | string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}

function displayName(row: {
  drill_slug: string | null;
  red_zone_tag: string | null;
  reason: string;
}): string {
  if (row.drill_slug) return kebabToTitle(row.drill_slug);
  if (row.red_zone_tag) return humanizeTag(row.red_zone_tag);
  return row.reason;
}

// ---------------------------------------------------------------------------
// DB-touching helpers
// ---------------------------------------------------------------------------

async function selectByTrapTag(
  client: DbClient,
  tag: string,
  size: number,
): Promise<string[]> {
  const { rows } = await client.query<QuestionIdRow>(
    `SELECT question_id FROM (
       SELECT DISTINCT q.question_id
         FROM questions q
         JOIN answer_choices ac
           ON ac.question_id = q.question_id AND ac.is_correct = 0
        WHERE q.status = 'active'
          AND ( JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))
             OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1)) )
     ) t
     ORDER BY RAND()
     LIMIT $2`,
    [tag, size],
  );
  return rows.map((r) => r.question_id);
}

async function selectQuestionIds(
  client: DbClient,
  input: NormalizedStartInput,
): Promise<string[]> {
  if (input.kind === "tension") {
    const { rows } = await client.query<QuestionIdRow>(
      `SELECT question_id FROM (
         SELECT DISTINCT q.question_id
           FROM questions q
          WHERE q.status = 'active'
            AND ( q.tension_point = $1
               OR EXISTS (
                    SELECT 1 FROM question_tags qt
                     WHERE qt.question_id = q.question_id
                       AND qt.dimension IN ('tension', 'tension_point')
                       AND qt.value = $1 ) )
       ) t
       ORDER BY RAND()
       LIMIT $2`,
      [input.slug, input.size],
    );
    return rows.map((r) => r.question_id);
  }

  if (input.kind === "trap") {
    return selectByTrapTag(client, input.slug ?? "", input.size);
  }

  // prescribed_red_zone
  const col = mapDimensionToColumn(input.red_zone_dimension);
  if (col) {
    const { rows } = await client.query<QuestionIdRow>(
      // col is from the TRACKED_COLUMNS whitelist, never user input.
      `SELECT question_id FROM (
         SELECT DISTINCT q.question_id
           FROM questions q
          WHERE q.status = 'active' AND q.${col} = $1
       ) t
       ORDER BY RAND()
       LIMIT $2`,
      [input.red_zone_tag, input.size],
    );
    return rows.map((r) => r.question_id);
  }
  // Untracked dimension (e.g. wrong_answer_architecture): treat tag as a trap.
  return selectByTrapTag(client, input.red_zone_tag ?? "", input.size);
}

async function ensureAnonymousStudent(client: DbClient): Promise<string | null> {
  const anonEmail = `anon-drill-${randomUUID()}@barmatrix.local`;
  await client.query(
    `INSERT INTO students (email, full_name, status, consent_flags)
          VALUES ($1, 'Anonymous drill', 'anonymous', JSON_OBJECT('anonymous', true))
     ON DUPLICATE KEY UPDATE status = status`,
    [anonEmail],
  );
  const { rows } = await client.query<StudentIdRow>(
    "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
    [anonEmail],
  );
  return rows[0]?.student_id ?? null;
}

/**
 * Progress for a drill, aggregated by set_id ALONE (the assignment_id is unique,
 * so only this drill's attempts carry it). Latest-attempt-wins per question,
 * mirroring routes/boot-camps.ts#answeredMapForSet.
 */
async function drillProgress(
  db: DbPool | DbClient,
  drillId: string,
  total: number,
): Promise<{ answered: number; correct: number; total: number }> {
  if (total === 0) return { answered: 0, correct: 0, total: 0 };
  const { rows } = await db.query<AttemptRow>(
    `SELECT a.question_id, a.correct
       FROM student_attempts a
      WHERE a.set_id = $1
      ORDER BY a.attempted_at ASC`,
    [drillId],
  );
  const latest = new Map<string, boolean>();
  for (const row of rows) latest.set(row.question_id, isTruthy(row.correct));
  const correct = [...latest.values()].filter(Boolean).length;
  return { answered: latest.size, correct, total };
}

/**
 * Read-only red-zone snapshot for the drill's target. The per-attempt flow in
 * routes/attempts.ts already moved the score; this reads the current standing
 * (mirrors routes/boot-camps.ts#redZoneSnapshot — never re-applies a bump).
 * Returns null for untracked dimensions or when no row exists (e.g. anonymous).
 */
async function redZoneSnapshot(
  db: DbPool | DbClient,
  studentId: string,
  dimension: string | null,
  tag: string | null,
): Promise<{
  dimension: string;
  tag: string;
  proficiency_score: number;
  attempts: number;
  high_confidence_wrongs: number;
} | null> {
  const col = mapDimensionToColumn(dimension);
  if (!col || !tag) return null;
  try {
    const { rows } = await db.query<RedZoneRow>(
      `SELECT proficiency_score, attempts_count, high_confidence_wrong_count
         FROM user_red_zones
        WHERE student_id = $1 AND dimension = $2 AND tag_value = $3
        LIMIT 1`,
      [studentId, dimension, tag],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      dimension: dimension as string,
      tag,
      proficiency_score: Number(r.proficiency_score),
      attempts: r.attempts_count,
      high_confidence_wrongs: r.high_confidence_wrong_count,
    };
  } catch (err) {
    console.error("[drills red-zone snapshot] failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerDrillsRoutes(app: Express): void {
  // ---- catalog -----------------------------------------------------------
  app.get("/api/drills/catalog", async (_req: Request, res: Response) => {
    const pool = getPool();
    let tensions: Array<{ slug: string; label: string; question_count: number }> = [];
    let traps: Array<{ slug: string; label: string; question_count: number }> = [];

    try {
      const { rows } = await pool.query<CatalogRow>(
        `SELECT tension_point AS slug, COUNT(*) AS question_count
           FROM questions
          WHERE status = 'active' AND tension_point IS NOT NULL AND tension_point <> ''
          GROUP BY tension_point
         HAVING COUNT(*) > 0
          ORDER BY question_count DESC, tension_point ASC
          LIMIT $1`,
        [CATALOG_LIMIT],
      );
      tensions = rows.map((r) => ({
        slug: r.slug,
        label: humanizeTag(r.slug),
        question_count: Number(r.question_count),
      }));
    } catch (err) {
      console.error("[drills catalog] tensions failed:", err);
    }

    try {
      // JSON_TABLE explodes each wrong choice's forensic_tags array into rows so
      // we can count distinct trap architectures across the active bank.
      const { rows } = await pool.query<CatalogRow>(
        `SELECT t.slug AS slug, COUNT(DISTINCT t.question_id) AS question_count
           FROM (
             SELECT q.question_id, jt.tag AS slug
               FROM questions q
               JOIN answer_choices ac
                 ON ac.question_id = q.question_id AND ac.is_correct = 0
               JOIN JSON_TABLE(ac.forensic_tags, '$[*]'
                      COLUMNS (tag VARCHAR(255) PATH '$')) jt
              WHERE q.status = 'active'
           ) t
          WHERE t.slug IS NOT NULL AND t.slug <> '' AND t.slug <> 'correct_answer'
            AND t.slug NOT LIKE 'source%'
          GROUP BY t.slug
         HAVING COUNT(DISTINCT t.question_id) > 0
          ORDER BY question_count DESC, t.slug ASC
          LIMIT $1`,
        [CATALOG_LIMIT],
      );
      traps = rows.map((r) => ({
        slug: r.slug,
        label: humanizeTag(r.slug),
        question_count: Number(r.question_count),
      }));
    } catch (err) {
      console.error("[drills catalog] traps failed (JSON_TABLE unavailable?):", err);
    }

    res.json({ tensions, traps });
  });

  // ---- prescribed --------------------------------------------------------
  app.get("/api/drills/prescribed", async (req: Request, res: Response) => {
    const studentId =
      typeof req.query.student_id === "string" ? req.query.student_id : "";
    if (!UUID_RE.test(studentId)) {
      res.json({
        suggested: [],
        in_progress: [],
        message: "Take the diagnostic to unlock prescribed drills.",
      });
      return;
    }

    try {
      const pool = getPool();
      const [zoneRes, ipRes] = await Promise.all([
        pool.query<ZoneSuggestionRow>(
          `SELECT rz.dimension, rz.tag_value, rz.proficiency_score,
                  rz.attempts_count, rz.high_confidence_wrong_count,
                  ( SELECT COUNT(*) FROM questions q
                     WHERE q.status = 'active'
                       AND ( (rz.dimension = 'subject'       AND q.subject = rz.tag_value)
                          OR (rz.dimension = 'subtopic'      AND q.subtopic = rz.tag_value)
                          OR (rz.dimension = 'tension_point' AND q.tension_point = rz.tag_value) )
                  ) AS candidate_question_count
             FROM user_red_zones rz
            WHERE rz.student_id = $1
              AND rz.dimension IN ('subject', 'subtopic', 'tension_point')
            ORDER BY rz.proficiency_score ASC, rz.high_confidence_wrong_count DESC
            LIMIT $2`,
          [studentId, MAX_SUGGESTED],
        ),
        pool.query<InProgressRow>(
          `SELECT assignment_id, drill_slug, reason, red_zone_dimension,
                  red_zone_tag, status, JSON_LENGTH(question_ids) AS question_count,
                  prescribed_at
             FROM drill_assignments
            WHERE student_id = $1 AND status = 'in_progress'
            ORDER BY prescribed_at DESC
            LIMIT $2`,
          [studentId, MAX_IN_PROGRESS],
        ),
      ]);

      const suggested = zoneRes.rows
        .filter((r) => Number(r.candidate_question_count) > 0)
        .map((r) => {
          const candidates = Number(r.candidate_question_count);
          return {
            kind: "prescribed_red_zone" as const,
            red_zone_dimension: r.dimension,
            red_zone_tag: r.tag_value,
            label: humanizeTag(r.tag_value),
            proficiency_score: Number(r.proficiency_score),
            candidate_question_count: candidates,
            suggested_size: Math.min(DEFAULT_DRILL_SIZE, candidates),
          };
        });

      const inProgress = ipRes.rows.map((r) => ({
        drill_id: r.assignment_id,
        drill_name: displayName(r),
        red_zone_dimension: r.red_zone_dimension,
        red_zone_tag: r.red_zone_tag,
        status: r.status,
        question_count: Number(r.question_count ?? 0),
        prescribed_at: r.prescribed_at,
      }));

      res.json({ suggested, in_progress: inProgress });
    } catch (err) {
      console.error("[drills prescribed] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ---- start -------------------------------------------------------------
  app.post("/api/drills/start", async (req: Request, res: Response) => {
    let input: NormalizedStartInput;
    try {
      input = normalizeStartInput(req.body);
    } catch (err) {
      if (err instanceof DrillInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const target = redZoneTargetFor(input);
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let studentId = input.student_id;
      if (studentId === null) {
        studentId = await ensureAnonymousStudent(client);
        if (studentId === null) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "failed to allocate anonymous student" });
          return;
        }
      }

      const ids = await selectQuestionIds(client, input);

      if (ids.length === 0) {
        await client.query("ROLLBACK");
        res.json({
          drill_id: null,
          student_id: studentId,
          question_ids: [],
          size: 0,
          requested: input.size,
          matched: 0,
          partial: true,
          red_zone_dimension: target.dimension,
          red_zone_tag: target.tag,
          drill_name: drillNameFor(input),
        });
        return;
      }

      const assignmentId = randomUUID();
      const drillSlug = input.slug && input.slug.length <= 128 ? input.slug : null;
      // question_ids is a JSON column. Pass the stringified array directly — the
      // prod DB is MariaDB, which has no `CAST(... AS JSON)` (JSON is a LONGTEXT
      // alias there); a valid JSON string is accepted by both MariaDB and MySQL 8.
      await client.query(
        `INSERT INTO drill_assignments
           (assignment_id, student_id, drill_slug, reason, red_zone_dimension,
            red_zone_tag, question_ids, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress')`,
        [
          assignmentId,
          studentId,
          drillSlug,
          reasonFor(input),
          target.dimension || null,
          target.tag || null,
          JSON.stringify(ids),
        ],
      );

      await client.query("COMMIT");

      res.json({
        drill_id: assignmentId,
        student_id: studentId,
        question_ids: ids,
        size: ids.length,
        requested: input.size,
        matched: ids.length,
        partial: ids.length < input.size,
        red_zone_dimension: target.dimension,
        red_zone_tag: target.tag,
        drill_name: drillNameFor(input),
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[drills start] failed:", err);
      res.status(500).json({ error: "internal server error" });
    } finally {
      client.release();
    }
  });

  // ---- detail ------------------------------------------------------------
  app.get("/api/drills/:drill_id", async (req: Request, res: Response) => {
    const id = req.params.drill_id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid drill id" });
      return;
    }
    try {
      const pool = getPool();
      const { rows } = await pool.query<AssignmentRow>(
        `SELECT assignment_id, student_id, drill_slug, reason, red_zone_dimension,
                red_zone_tag, question_ids, status, prescribed_at, completed_at
           FROM drill_assignments
          WHERE assignment_id = $1
          LIMIT 1`,
        [id],
      );
      const a = rows[0];
      if (!a) {
        res.status(404).json({ error: "drill not found" });
        return;
      }
      const questionIds = parseJsonIdArray(a.question_ids);
      const progress = await drillProgress(pool, id, questionIds.length);
      res.json({
        drill_id: a.assignment_id,
        student_id: a.student_id,
        status: a.status,
        drill_name: displayName(a),
        red_zone_dimension: a.red_zone_dimension,
        red_zone_tag: a.red_zone_tag,
        question_ids: questionIds,
        size: questionIds.length,
        progress,
      });
    } catch (err) {
      console.error("[drills detail] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ---- complete ----------------------------------------------------------
  app.post("/api/drills/:drill_id/complete", async (req: Request, res: Response) => {
    const id = req.params.drill_id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid drill id" });
      return;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query<AssignmentRow>(
        `SELECT assignment_id, student_id, drill_slug, reason, red_zone_dimension,
                red_zone_tag, question_ids, status
           FROM drill_assignments
          WHERE assignment_id = $1
          LIMIT 1`,
        [id],
      );
      const a = rows[0];
      if (!a) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "drill not found" });
        return;
      }

      const questionIds = parseJsonIdArray(a.question_ids);
      const progress = await drillProgress(client, id, questionIds.length);
      const { mastered } = masteryResult(progress.correct, progress.total);

      let status = a.status;
      if (mastered && a.status !== "completed") {
        await client.query(
          `UPDATE drill_assignments
              SET status = 'completed', completed_at = CURRENT_TIMESTAMP(6)
            WHERE assignment_id = $1`,
          [id],
        );
        status = "completed";
      }

      const redZone = await redZoneSnapshot(
        client,
        a.student_id,
        a.red_zone_dimension,
        a.red_zone_tag,
      );

      await client.query("COMMIT");

      res.json({
        drill_id: id,
        correct: progress.correct,
        total: progress.total,
        answered: progress.answered,
        mastered,
        status,
        red_zone: redZone,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[drills complete] failed:", err);
      res.status(500).json({ error: "internal server error" });
    } finally {
      client.release();
    }
  });
}
