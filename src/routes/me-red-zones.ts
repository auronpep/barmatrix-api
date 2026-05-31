// Authenticated Red Zone Library — the browsable, per-student view of where a
// student's wrong answers cluster, with drill-in detail per zone.
//
//   GET /api/me/red-zones            — library index (all zones by dimension).
//   GET /api/me/red-zones/zone       — one zone's detail (?dimension=&tag=).
//
// Auth: @clerk/express clerkMiddleware scoped to these routes. The student is
// resolved SERVER-SIDE from the Clerk email (see lib/me-student.ts); never from
// a client-supplied id. Reads filter questions.status='active' by default and
// honor ?include_hidden=true only outside production, per the cross-component
// contract in HANDOFFS/15_FIVE_COMPONENT_WEB_BUILDOUT.md.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool, type DbPool } from "../db.js";
import { QUESTION_DIMENSION_COLUMNS } from "../lib/redzones.js";
import { kebabToTitle, snakeToTitle } from "../lib/format.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const ACTIVE_RED_ZONE_THRESHOLD = 0.7;
const MAX_ZONE_QUESTIONS = 50;
const MAX_RECENT_WRONGS = 8;

// Dimension order for a stable, sensible library layout.
const DIMENSION_ORDER = ["subject", "subtopic", "tension_point"] as const;

// Statuses we ever expose. Used to build a safe SQL IN-list of quoted literals
// (these are constants, never user input).
const ALLOWED_QUESTION_STATUSES = new Set(["active", "hidden"]);

type DimensionColumn = "subject" | "subtopic" | "tension_point";

interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}

interface NormalizedZone {
  dimension: string;
  tag: string;
  proficiency_score: number;
  attempts: number;
  high_confidence_wrong_count: number;
}

interface QuestionRefRow {
  question_id: string;
  external_id: string | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
}

interface WrongAttemptRow {
  attempt_id: string;
  question_id: string;
  selected_letter: string | null;
  attempted_at: Date | string;
  subject: string | null;
  subtopic: string | null;
  forensic_tags: unknown;
}

interface DrillRow {
  drill_slug: string | null;
  reason: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests — no DB, no HTTP).
// ---------------------------------------------------------------------------

/** Map a red-zone dimension to its whitelisted question column, or null. */
export function resolveDimensionColumn(dimension: string): DimensionColumn | null {
  const found = QUESTION_DIMENSION_COLUMNS.find((d) => d.dimension === dimension);
  return found ? found.column : null;
}

/** Subject display value -> the `/drills/{slug}` route slug. */
export function subjectToDrillSlug(subject: string): string {
  return subject
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Most-frequent subject across a set of question rows, or null. */
export function dominantSubject(
  rows: ReadonlyArray<{ subject: string | null }>,
): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.subject) continue;
    counts.set(r.subject, (counts.get(r.subject) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [subject, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = subject;
    }
  }
  return best;
}

export interface LibraryMetrics {
  repair_progress_pct: number;
  active_red_zones: number;
  high_confidence_wrongs: number;
  total_zones: number;
}

/** Aggregate library metrics from the student's zones. */
export function deriveLibraryMetrics(
  zones: ReadonlyArray<{
    proficiency_score: number;
    high_confidence_wrong_count: number;
  }>,
): LibraryMetrics {
  let profSum = 0;
  let activeRedZones = 0;
  let highConfidenceWrongs = 0;
  for (const z of zones) {
    profSum += z.proficiency_score;
    if (z.proficiency_score < ACTIVE_RED_ZONE_THRESHOLD) activeRedZones += 1;
    highConfidenceWrongs += z.high_confidence_wrong_count;
  }
  const repairPct =
    zones.length > 0 ? Math.round((profSum / zones.length) * 100) : 0;
  return {
    repair_progress_pct: repairPct,
    active_red_zones: activeRedZones,
    high_confidence_wrongs: highConfidenceWrongs,
    total_zones: zones.length,
  };
}

/** Stable dimension sort: known dimensions first (in product order), then a-z. */
export function compareDimensions(a: string, b: string): number {
  const ia = DIMENSION_ORDER.indexOf(a as (typeof DIMENSION_ORDER)[number]);
  const ib = DIMENSION_ORDER.indexOf(b as (typeof DIMENSION_ORDER)[number]);
  const ra = ia === -1 ? DIMENSION_ORDER.length : ia;
  const rb = ib === -1 ? DIMENSION_ORDER.length : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/** Wrong-answer trap label from a choice's forensic tags / subtopic. */
export function trapNameFrom(
  forensicTags: unknown,
  subtopic: string | null,
): string {
  const tags = asStringArray(forensicTags).filter(
    (t) => t && t !== "correct_answer",
  );
  if (tags[0]) return `${snakeToTitle(tags[0])} trap`;
  if (subtopic) return `${subtopic} trap`;
  return "Wrong-answer trap";
}

function asStringArray(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

/** Build the SQL IN-list of quoted status literals from a whitelist. */
export function statusListSql(statuses: readonly string[]): string {
  const safe = statuses.filter((s) => ALLOWED_QUESTION_STATUSES.has(s));
  const list = safe.length > 0 ? safe : ["active"];
  return list.map((s) => `'${s}'`).join(", ");
}

function questionStatuses(req: Request): string[] {
  const includeHidden =
    req.query.include_hidden === "true" &&
    process.env.NODE_ENV !== "production";
  return includeHidden ? ["active", "hidden"] : ["active"];
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

// Count active (or active+hidden) questions per (dimension, tag) for the tags
// present in the student's red zones. One grouped query per present dimension.
async function loadQuestionCounts(
  pool: DbPool,
  zones: ReadonlyArray<NormalizedZone>,
  statusSql: string,
): Promise<Map<string, number>> {
  const tagsByDimension = new Map<DimensionColumn, Set<string>>();
  for (const z of zones) {
    const column = resolveDimensionColumn(z.dimension);
    if (!column) continue;
    const set = tagsByDimension.get(column) ?? new Set<string>();
    set.add(z.tag);
    tagsByDimension.set(column, set);
  }

  const counts = new Map<string, number>();
  for (const [column, tagSet] of tagsByDimension) {
    const tags = [...tagSet];
    if (tags.length === 0) continue;
    const placeholders = tags.map((_t, i) => `$${i + 1}`).join(", ");
    // `column` is a whitelisted constant; `statusSql` is quoted literals from a
    // whitelist; tags are parameterized.
    const { rows } = await pool.query<{ tag: string; n: number | string }>(
      `SELECT ${column} AS tag, COUNT(*) AS n
         FROM questions
        WHERE ${column} IN (${placeholders}) AND status IN (${statusSql})
        GROUP BY ${column}`,
      tags,
    );
    const dimension = QUESTION_DIMENSION_COLUMNS.find(
      (d) => d.column === column,
    )?.dimension;
    if (!dimension) continue;
    for (const r of rows) {
      counts.set(`${dimension}|${r.tag}`, Number(r.n));
    }
  }
  return counts;
}

function emptyLibrary() {
  return {
    enrolled: false,
    status: null as string | null,
    refunded: false,
    student_id: null as string | null,
    metrics: {
      repair_progress_pct: 0,
      active_red_zones: 0,
      high_confidence_wrongs: 0,
      total_zones: 0,
    },
    dimensions: [] as unknown[],
  };
}

function emptyDetail(dimension: string, tag: string) {
  return {
    enrolled: false,
    dimension,
    tag,
    repair_subject: null as string | null,
    repair_slug: null as string | null,
    zone: null as unknown,
    questions: [] as unknown[],
    recent_wrongs: [] as unknown[],
    drill: null as unknown,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerMeRedZonesRoutes(app: Express): void {
  app.get(
    "/api/me/red-zones",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      try {
        const resolution = await resolveClerkStudent(req);
        if (resolution.kind === "unauthenticated") {
          res.status(401).json({ error: "not authenticated" });
          return;
        }
        if (resolution.kind === "clerk_error") {
          res.status(502).json({ error: "auth provider lookup failed" });
          return;
        }
        if (resolution.kind === "not_enrolled") {
          res.json(emptyLibrary());
          return;
        }

        const studentId = resolution.student.student_id;
        const pool = getPool();

        const { rows: rzRows } = await pool.query<RedZoneRow>(
          `SELECT dimension, tag_value, proficiency_score,
                  attempts_count, high_confidence_wrong_count
             FROM user_red_zones
            WHERE student_id = $1
            ORDER BY dimension ASC, proficiency_score ASC`,
          [studentId],
        );

        const zones: NormalizedZone[] = rzRows.map((r) => ({
          dimension: r.dimension,
          tag: r.tag_value,
          proficiency_score: Number(r.proficiency_score),
          attempts: r.attempts_count,
          high_confidence_wrong_count: r.high_confidence_wrong_count,
        }));

        const { rows: drillRows } = await pool.query<{
          red_zone_dimension: string | null;
          red_zone_tag: string | null;
        }>(
          `SELECT red_zone_dimension, red_zone_tag
             FROM drill_assignments
            WHERE student_id = $1 AND status IN ('prescribed', 'in_progress')`,
          [studentId],
        );
        const drillKeys = new Set(
          drillRows
            .filter((d) => d.red_zone_dimension && d.red_zone_tag)
            .map((d) => `${d.red_zone_dimension}|${d.red_zone_tag}`),
        );

        const countMap = await loadQuestionCounts(
          pool,
          zones,
          statusListSql(questionStatuses(req)),
        );

        const byDimension = new Map<
          string,
          Array<{
            tag: string;
            proficiency_score: number;
            attempts: number;
            high_confidence_wrongs: number;
            question_count: number;
            has_drill: boolean;
          }>
        >();
        for (const z of zones) {
          const list = byDimension.get(z.dimension) ?? [];
          list.push({
            tag: z.tag,
            proficiency_score: z.proficiency_score,
            attempts: z.attempts,
            high_confidence_wrongs: z.high_confidence_wrong_count,
            question_count: countMap.get(`${z.dimension}|${z.tag}`) ?? 0,
            has_drill: drillKeys.has(`${z.dimension}|${z.tag}`),
          });
          byDimension.set(z.dimension, list);
        }

        const dimensions = [...byDimension.keys()]
          .sort(compareDimensions)
          .map((dimension) => ({
            dimension,
            zones: byDimension.get(dimension) ?? [],
          }));

        res.json({
          enrolled: resolution.student.enrolled,
          status: resolution.student.status,
          refunded: resolution.student.refunded,
          student_id: studentId,
          metrics: deriveLibraryMetrics(
            zones.map((z) => ({
              proficiency_score: z.proficiency_score,
              high_confidence_wrong_count: z.high_confidence_wrong_count,
            })),
          ),
          dimensions,
        });
      } catch (err) {
        console.error("[me red-zones index] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.get(
    "/api/me/red-zones/zone",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const dimension =
        typeof req.query.dimension === "string" ? req.query.dimension : "";
      const tag = typeof req.query.tag === "string" ? req.query.tag : "";
      const column = resolveDimensionColumn(dimension);
      if (!column || !tag) {
        res.status(400).json({ error: "invalid dimension or tag" });
        return;
      }

      try {
        const resolution = await resolveClerkStudent(req);
        if (resolution.kind === "unauthenticated") {
          res.status(401).json({ error: "not authenticated" });
          return;
        }
        if (resolution.kind === "clerk_error") {
          res.status(502).json({ error: "auth provider lookup failed" });
          return;
        }
        if (resolution.kind === "not_enrolled") {
          res.json(emptyDetail(dimension, tag));
          return;
        }

        const studentId = resolution.student.student_id;
        const pool = getPool();
        const statusSql = statusListSql(questionStatuses(req));

        const { rows: zoneRows } = await pool.query<RedZoneRow>(
          `SELECT dimension, tag_value, proficiency_score,
                  attempts_count, high_confidence_wrong_count
             FROM user_red_zones
            WHERE student_id = $1 AND dimension = $2 AND tag_value = $3
            LIMIT 1`,
          [studentId, dimension, tag],
        );

        // `column` is a whitelisted constant; values are parameterized.
        const { rows: questionRows } = await pool.query<QuestionRefRow>(
          `SELECT question_id, external_id, subject, subtopic, tension_point
             FROM questions
            WHERE ${column} = $1 AND status IN (${statusSql})
            ORDER BY subtopic ASC, question_id ASC
            LIMIT ${MAX_ZONE_QUESTIONS}`,
          [tag],
        );

        const { rows: countRows } = await pool.query<{ n: number | string }>(
          `SELECT COUNT(*) AS n
             FROM questions
            WHERE ${column} = $1 AND status IN (${statusSql})`,
          [tag],
        );
        const questionCount = Number(countRows[0]?.n ?? questionRows.length);

        const { rows: wrongRows } = await pool.query<WrongAttemptRow>(
          `SELECT a.attempt_id, a.question_id, a.selected_letter, a.attempted_at,
                  q.subject, q.subtopic, ac.forensic_tags
             FROM student_attempts a
             JOIN questions q ON q.question_id = a.question_id
             LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
            WHERE a.student_id = $1 AND q.${column} = $2 AND a.correct = 0 AND q.status IN (${statusSql})
            ORDER BY a.attempted_at DESC
            LIMIT ${MAX_RECENT_WRONGS}`,
          [studentId, tag],
        );

        const { rows: drillRows } = await pool.query<DrillRow>(
          `SELECT drill_slug, reason, status
             FROM drill_assignments
            WHERE student_id = $1
              AND red_zone_dimension = $2
              AND red_zone_tag = $3
              AND status IN ('prescribed', 'in_progress')
            ORDER BY prescribed_at DESC
            LIMIT 1`,
          [studentId, dimension, tag],
        );

        const repairSubject =
          column === "subject" ? tag : dominantSubject(questionRows);
        const repairSlug = repairSubject
          ? subjectToDrillSlug(repairSubject)
          : null;

        const zoneRow = zoneRows[0];
        const zone = zoneRow
          ? {
              proficiency_score: Number(zoneRow.proficiency_score),
              attempts: zoneRow.attempts_count,
              high_confidence_wrongs: zoneRow.high_confidence_wrong_count,
              question_count: questionCount,
            }
          : null;

        const drill = drillRows[0]
          ? {
              drill_slug: drillRows[0].drill_slug,
              drill_name: drillRows[0].drill_slug
                ? kebabToTitle(drillRows[0].drill_slug)
                : drillRows[0].reason,
              reason: drillRows[0].reason,
              status: drillRows[0].status,
            }
          : null;

        res.json({
          enrolled: resolution.student.enrolled,
          dimension,
          tag,
          repair_subject: repairSubject,
          repair_slug: repairSlug,
          zone,
          questions: questionRows.map((q) => ({
            question_id: q.question_id,
            external_id: q.external_id,
            subject: q.subject,
            subtopic: q.subtopic,
            tension_point: q.tension_point,
          })),
          recent_wrongs: wrongRows.map((w) => ({
            attempt_id: w.attempt_id,
            question_id: w.question_id,
            subject: w.subject,
            subtopic: w.subtopic,
            selected_letter: w.selected_letter,
            trap_name: trapNameFrom(w.forensic_tags, w.subtopic),
            attempted_at: w.attempted_at,
          })),
          drill,
        });
      } catch (err) {
        console.error("[me red-zones zone] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}
