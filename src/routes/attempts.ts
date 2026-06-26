// POST /api/attempts        — record an answer, update red-zones, queue drill
// GET  /api/attempts/:id/forensics — hydrate the Wrong Answer Forensics card
//
// Identity is resolved server-side from the Clerk session (optional auth):
//   - signed in  -> the caller's own student row; red-zones + drills update.
//   - signed out -> a synthetic anonymous row keyed on
//     anon-{set_id}@barmatrix.local so all attempts in one diagnostic session
//     attach to one student. Anonymous attempts skip red-zone + drill writes.
// A client-supplied student_id is never trusted (no cross-student writes).

import type { Express, Request, Response } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { getPool, type DbClient } from "../db.js";
import { kebabToTitle, snakeToTitle } from "../lib/format.js";
import {
  QUESTION_DIMENSION_COLUMNS,
  upsertColumnDerivedRedZone,
  type RedZoneUpdate,
} from "../lib/redzones.js";
import {
  resolveClerkEmail,
  findOrCreateStudentByEmail,
} from "../lib/clerk-identity.js";
import { fresh, applySuccess, applyLapse, type MoldSrs } from "../lib/c3-srs.js";
import {
  confusionInputSchema,
  confusionPatchSchema,
  buildConfusionTagRows,
  type ConfusionSource,
  type ConfusionTagRow,
  type QuestionChoiceRef,
} from "../lib/confusion.js";
import {
  interactionLogSchema,
  summarizeInteractionLog,
  MAX_LOG_BYTES,
  type InteractionEvent,
  type TelemetrySummary,
} from "../lib/attempt-telemetry.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Per SRC-0007 CLAIMS_SIGNOFF: never publish focus-group data below n=30.
const FOCUS_GROUP_MIN_SAMPLE = 30;

// set_id is a CHAR(36) column. The diagnostic sends a real UUID, but the drill
// and timed-set surfaces send human-readable labels like "evidence-inline-<ts>"
// (some exceed 36 chars). Normalize any non-UUID label into a deterministic
// UUID so it fits the column AND still groups one session's attempts together.
function normalizeSetId(raw: string | undefined): string | null {
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  const h = createHash("sha1").update(raw).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export const attemptBody = z.object({
  question_id: z.string().uuid(),
  selected_letter: z.enum(["A", "B", "C", "D"]),
  confidence: z.number().int().min(1).max(5),
  // Coin/fork recognition: the student marked this item as a guess/toss-up.
  // Feeds calibration "flag quality" analytics. Optional + defaulted so older
  // clients keep working. Requires student_attempts.flagged (SCHEMA_C3_ENHANCE).
  flagged: z.boolean().default(false),
  time_seconds: z.number().int().min(0),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  set_id: z.string().min(1).max(128).optional(),
  // Confusion-Capture (optional): which choices the student knew were wrong vs
  // was deciding between, keyed by stable choice_id. Stored in attempt_choice_tags
  // (SCHEMA_CONFUSION_CAPTURE_MYSQL.sql). Optional + best-effort so older clients
  // and a missing table never break an attempt.
  confusion: confusionInputSchema.optional(),
  // Behavioral micro-signal stream (spec 2026-06-12). Deliberately z.unknown():
  // malformed telemetry must never 400 the attempt; it is validated separately
  // in buildAttemptMetadata and dropped on failure.
  interaction_log: z.unknown().optional(),
});

export const forensicsDwellBody = z.object({
  dwell_ms: z.number().int().min(0).max(86_400_000),
});

interface QuestionForAttempt {
  question_id: string;
  subject: string;
  subtopic: string | null;
  tension_point: string | null;
}

interface ChoiceForAttempt {
  choice_id: string;
  is_correct: boolean | 0 | 1;
  remediation_id: string | null;
  c3_mold_code: string | null;
}

interface CorrectChoice {
  letter: "A" | "B" | "C" | "D";
}

interface AnonStudent {
  student_id: string;
}

function isMissingC3MoldColumn(err: unknown): boolean {
  const e = err as {
    code?: unknown;
    errno?: unknown;
    message?: unknown;
    sqlMessage?: unknown;
  } | null;
  if (!e || (e.code !== "ER_BAD_FIELD_ERROR" && e.errno !== 1054)) return false;
  const message = String(e.sqlMessage ?? e.message ?? "");
  return message.includes("c3_mold_code");
}

export async function findSelectedChoiceForAttempt(
  client: Pick<DbClient, "query">,
  questionId: string,
  selectedLetter: "A" | "B" | "C" | "D",
): Promise<ChoiceForAttempt | null> {
  try {
    const { rows } = await client.query<ChoiceForAttempt>(
      `SELECT choice_id, is_correct, remediation_id, c3_mold_code
         FROM answer_choices
        WHERE question_id = $1 AND letter = $2
        LIMIT 1`,
      [questionId, selectedLetter],
    );
    return rows[0] ?? null;
  } catch (err) {
    if (!isMissingC3MoldColumn(err)) throw err;
  }

  const { rows } = await client.query<Omit<ChoiceForAttempt, "c3_mold_code">>(
    `SELECT choice_id, is_correct, remediation_id
       FROM answer_choices
      WHERE question_id = $1 AND letter = $2
      LIMIT 1`,
    [questionId, selectedLetter],
  );
  const selected = rows[0];
  return selected ? { ...selected, c3_mold_code: null } : null;
}

export async function listQuestionC3MoldCodesForAttempt(
  client: Pick<DbClient, "query">,
  questionId: string,
): Promise<string[]> {
  try {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT DISTINCT c3_mold_code FROM answer_choices
        WHERE question_id = $1 AND c3_mold_code IS NOT NULL`,
      [questionId],
    );
    return rows.map((r) => String(r.c3_mold_code));
  } catch (err) {
    if (isMissingC3MoldColumn(err)) return [];
    throw err;
  }
}

/** All choices for a question (choice_id, letter, is_correct) — used to resolve a
 *  confusion payload's choice_ids and set is_selected/is_correct on each tag. */
export async function listQuestionChoicesForAttempt(
  client: Pick<DbClient, "query">,
  questionId: string,
): Promise<QuestionChoiceRef[]> {
  const { rows } = await client.query<QuestionChoiceRef>(
    `SELECT choice_id, letter, is_correct
       FROM answer_choices
      WHERE question_id = $1`,
    [questionId],
  );
  return rows;
}

/** True when the optional attempt_choice_tags table is not provisioned (1146).
 *  Confusion capture is founder-gated and may be absent in production. */
export function isMissingConfusionTable(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

/** Bulk-insert confusion tag rows (one per tagged choice) for an attempt. */
export async function insertConfusionTagRows(
  client: Pick<DbClient, "query">,
  attemptId: string,
  questionId: string,
  source: ConfusionSource,
  rows: ReadonlyArray<ConfusionTagRow>,
): Promise<void> {
  if (rows.length === 0) return;
  const PARAMS_PER_ROW = 7;
  const placeholders = rows
    .map((_r, i) => {
      const b = i * PARAMS_PER_ROW;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
    })
    .join(", ");
  const values = rows.flatMap((r) => [
    attemptId,
    r.choice_id,
    questionId,
    r.letter,
    r.bucket,
    r.is_selected ? 1 : 0,
    source,
  ]);
  await client.query(
    `INSERT INTO attempt_choice_tags
       (attempt_id, choice_id, question_id, letter, bucket, is_selected, source)
     VALUES ${placeholders}`,
    values,
  );
}

export interface AttemptMetadata {
  [key: string]: unknown;
  interaction_log?: InteractionEvent[];
  telemetry?: TelemetrySummary;
}

export function buildAttemptMetadata(
  base: Record<string, unknown>,
  rawLog: unknown,
  correctLetter: "A" | "B" | "C" | "D" | null,
): AttemptMetadata {
  if (rawLog === undefined || rawLog === null) return { ...base };
  const parsed = interactionLogSchema.safeParse(rawLog);
  if (!parsed.success) {
    console.warn("[attempts post] dropped malformed interaction_log");
    return { ...base };
  }
  const telemetry = summarizeInteractionLog(parsed.data, correctLetter);
  // With MAX_EVENTS=200 this is near-unreachable belt-and-braces; kept cheap.
  const serialized = JSON.stringify(parsed.data);
  if (serialized.length > MAX_LOG_BYTES) {
    console.warn("[attempts post] interaction_log over byte cap; kept summary only");
    return { ...base, telemetry };
  }
  return { ...base, interaction_log: parsed.data, telemetry };
}

export function registerAttemptsRoutes(app: Express): void {
  app.post("/api/attempts", clerkMiddleware(), async (req: Request, res: Response) => {
    const parse = attemptBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }
    const body = parse.data;
    const setId = normalizeSetId(body.set_id);

    // Resolve the Clerk session (optional auth) BEFORE opening the transaction
    // so we never hold one open across the network call to Clerk. No session ->
    // anonymous attempt; a session that resolves to an email -> attributed.
    const { userId } = getAuth(req);
    let authedEmail: string | null = null;
    if (userId) {
      try {
        authedEmail = await resolveClerkEmail(userId);
      } catch (err) {
        console.error("[attempts post] clerk lookup failed:", err);
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Resolve the selected choice to compute correctness + remediation.
      const selected = await findSelectedChoiceForAttempt(
        client,
        body.question_id,
        body.selected_letter,
      );
      if (!selected) {
        await client.query("ROLLBACK");
        res.status(404).json({
          error: `no choice ${body.selected_letter} for question ${body.question_id}`,
        });
        return;
      }

      const { rows: correctRows } = await client.query<CorrectChoice>(
        `SELECT letter
           FROM answer_choices
          WHERE question_id = $1 AND is_correct = 1
          LIMIT 1`,
        [body.question_id],
      );
      const correctAnswer = correctRows[0]?.letter ?? null;

      // 2. Resolve student_id SERVER-SIDE. A signed-in student attributes to
      // their own row so red-zones + drills update; everyone else attaches to a
      // synthetic anonymous row keyed by set_id so one diagnostic session's
      // attempts group together.
      let studentId: string;
      const isAnonymous = authedEmail === null;
      if (authedEmail) {
        studentId = await findOrCreateStudentByEmail(client, authedEmail);
      } else {
        const anonEmail = setId
          ? `anon-${setId}@barmatrix.local`
          : `anon-${randomUUID()}@barmatrix.local`;
        await client.query(
          `INSERT INTO students (email, full_name, status, consent_flags)
                VALUES ($1, 'Anonymous diagnostic', 'anonymous', JSON_OBJECT('anonymous', true))
           ON DUPLICATE KEY UPDATE status = status`,
          [anonEmail],
        );
        const { rows: anonRows } = await client.query<AnonStudent>(
          "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
          [anonEmail],
        );
        const anonId = anonRows[0]?.student_id ?? null;
        if (anonId === null) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "failed to allocate anonymous student" });
          return;
        }
        studentId = anonId;
      }

      // 3. Insert the attempt.
      const selectedIsCorrect = selected.is_correct === true || selected.is_correct === 1;
      const attemptId = randomUUID();
      await client.query(
        `INSERT INTO student_attempts
           (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
            correct, confidence, flagged, time_seconds, platform, set_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          attemptId,
          studentId,
          body.question_id,
          selected.choice_id,
          body.selected_letter,
          selectedIsCorrect,
          body.confidence,
          body.flagged ? 1 : 0,
          body.time_seconds,
          body.platform,
          setId,
          JSON.stringify(
            buildAttemptMetadata(
              isAnonymous ? { anonymous: true } : {},
              body.interaction_log,
              correctAnswer,
            ),
          ),
        ],
      );

      // 3b. Confusion capture (optional): resolve the tagged choice_ids against
      // this question's choices now (inside the txn) but write the tags AFTER
      // commit. Best-effort — a confusion glitch or an absent table must never
      // cost a recorded attempt, so unknown choice_ids are dropped (logged).
      let confusionRows: ConfusionTagRow[] = [];
      let confusionSource: ConfusionSource | null = null;
      if (body.confusion) {
        const choices = await listQuestionChoicesForAttempt(client, body.question_id);
        const built = buildConfusionTagRows(
          choices,
          body.confusion,
          selected.choice_id,
        );
        confusionRows = built.rows;
        confusionSource = body.confusion.source;
        if (built.dropped.length > 0) {
          console.warn(
            `[attempts post] confusion dropped unknown choice_ids for question ${body.question_id}:`,
            built.dropped,
          );
        }
      }

      // 4. Update red-zones + drill assignment when not anonymous.
      const redZoneUpdates: RedZoneUpdate[] = [];
      if (!isAnonymous) {
        const { rows: qrows } = await client.query<QuestionForAttempt>(
          `SELECT question_id, subject, subtopic, tension_point
             FROM questions
            WHERE question_id = $1
            LIMIT 1`,
          [body.question_id],
        );
        const q = qrows[0];
        if (q) {
          for (const { dimension, column } of QUESTION_DIMENSION_COLUMNS) {
            const value = q[column];
            if (value) {
              const upd = await upsertColumnDerivedRedZone(
                client,
                studentId,
                dimension,
                column,
                value,
              );
              if (upd) redZoneUpdates.push(upd);
            }
          }
        }

        if (!selectedIsCorrect && selected.remediation_id) {
          await client.query(
            `INSERT INTO drill_assignments
               (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, question_ids, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress')`,
            [
              randomUUID(),
              studentId,
              selected.remediation_id,
              "wrong_answer_forensics",
              q?.subtopic ? "subtopic" : null,
              q?.subtopic ?? null,
              JSON.stringify([body.question_id]),
            ],
          );
        }
      }

      await client.query("COMMIT");

      // Persist confusion tags AFTER commit so a missing table / write error can
      // never roll back the attempt. Awaited (so the common case stores before we
      // respond) but fully swallowed on failure.
      if (confusionSource && confusionRows.length > 0) {
        try {
          await insertConfusionTagRows(
            client,
            attemptId,
            body.question_id,
            confusionSource,
            confusionRows,
          );
        } catch (err) {
          if (isMissingConfusionTable(err)) {
            console.warn(
              "[attempts post] attempt_choice_tags absent — confusion not stored",
            );
          } else {
            console.error("[attempts post] confusion insert failed:", err);
          }
        }
      }

      // Fire-and-forget: persist SM-2 state so c3-coach doesn't replay full history.
      if (!isAnonymous) {
        void updateC3SrsAsync(
          studentId, body.question_id, selectedIsCorrect,
          selected.c3_mold_code ?? null, Date.now(),
        );
      }

      res.json({
        attempt_id: attemptId,
        correct: selectedIsCorrect,
        correct_answer: correctAnswer,
        forensics_url: `/api/attempts/${attemptId}/forensics`,
        red_zone_updates: redZoneUpdates,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[attempts post] failed:", err);
      res.status(500).json({ error: "internal server error" });
    } finally {
      client.release();
    }
  });

  app.get("/api/attempts/:id/forensics", async (req, res) => {
    const id = req.params.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid attempt id" });
      return;
    }

    interface ForensicsRow {
      attempt_correct: boolean | 0 | 1;
      selected_letter: "A" | "B" | "C" | "D";
      selected_forensic_tags: unknown;
      selected_why_attractive: string | null;
      selected_why_wrong_or_correct: string | null;
      selected_future_cue: string | null;
      selected_remediation_id: string | null;
      selected_pct: number | null;
      sample_size: number | null;
      question_subtopic: string | null;
      question_tension_point: string | null;
    }

    try {
      const pool = getPool();
      const { rows } = await pool.query<ForensicsRow>(
        `SELECT
            a.correct                AS attempt_correct,
            a.selected_letter        AS selected_letter,
            ac.forensic_tags         AS selected_forensic_tags,
            ac.misconception_tags    AS selected_misconception_tags,
            ac.why_attractive        AS selected_why_attractive,
            ac.why_wrong_or_correct  AS selected_why_wrong_or_correct,
            ac.future_cue            AS selected_future_cue,
            ac.remediation_id        AS selected_remediation_id,
            CASE a.selected_letter
              WHEN 'A' THEN fg.pct_a
              WHEN 'B' THEN fg.pct_b
              WHEN 'C' THEN fg.pct_c
              WHEN 'D' THEN fg.pct_d
            END                       AS selected_pct,
            fg.sample_size            AS sample_size,
            q.subtopic                AS question_subtopic,
            q.tension_point           AS question_tension_point
           FROM student_attempts a
           JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
           JOIN questions q ON q.question_id = a.question_id
           LEFT JOIN focus_group_response_data fg ON fg.question_id = a.question_id
          WHERE a.attempt_id = $1
          LIMIT 1`,
        [id],
      );
      const r = rows[0];
      if (!r) {
        res.status(404).json({ error: "attempt not found" });
        return;
      }

      // Focus-group block: enforce sample-size discipline per SRC-0007.
      const focusGroup =
        r.sample_size !== null &&
        r.sample_size >= FOCUS_GROUP_MIN_SAMPLE &&
        r.selected_pct !== null
          ? {
              selected_choice_pct: Number(r.selected_pct),
              sample_size: r.sample_size,
            }
          : null;

      if (r.attempt_correct === true || r.attempt_correct === 1) {
        res.json({
          correct: true,
          why_correct: r.selected_why_wrong_or_correct ?? "",
          focus_group: focusGroup,
        });
        return;
      }

      // Wrong answer: derive trap_name from the first non-meta forensic tag,
      // falling back to the question's subtopic.
      const forensicTags = asStringArray(r.selected_forensic_tags);
      const trapTag = forensicTags.find((t) => t && t !== "correct_answer");
      const trapName = trapTag
        ? `${snakeToTitle(trapTag)} trap`
        : r.question_subtopic
          ? `${r.question_subtopic} trap`
          : "Wrong-answer trap";

      const assignedDrill = r.selected_remediation_id
        ? { name: kebabToTitle(r.selected_remediation_id), slug: r.selected_remediation_id }
        : null;

      res.json({
        correct: false,
        trap_name: trapName,
        why_attractive: r.selected_why_attractive ?? "",
        why_wrong: r.selected_why_wrong_or_correct ?? "",
        future_cue: r.selected_future_cue ?? "",
        focus_group: focusGroup,
        assigned_drill: assignedDrill,
      });
    } catch (err) {
      console.error("[forensics get] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // PATCH /api/attempts/:id/confusion — the retrospective edit on the answer page.
  // Re-asserts the whole confusion set for one attempt. Authed + ownership-checked
  // (a caller can only edit their own attempt); replaces the tags transactionally.
  app.patch(
    "/api/attempts/:id/confusion",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }

      const id = req.params.id;
      if (typeof id !== "string" || !UUID_RE.test(id)) {
        res.status(400).json({ error: "invalid attempt id" });
        return;
      }
      const parse = confusionPatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten() });
        return;
      }

      let email: string | null;
      try {
        email = await resolveClerkEmail(userId);
      } catch (err) {
        console.error("[attempts confusion patch] clerk lookup failed:", err);
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (!email) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const { rows: aRows } = await client.query<{
          student_id: string;
          question_id: string;
          selected_choice_id: string | null;
        }>(
          `SELECT student_id, question_id, selected_choice_id
             FROM student_attempts WHERE attempt_id = $1 LIMIT 1`,
          [id],
        );
        const attemptRow = aRows[0];
        if (!attemptRow) {
          res.status(404).json({ error: "attempt not found" });
          return;
        }

        const callerStudentId = await findOrCreateStudentByEmail(client, email);
        if (attemptRow.student_id !== callerStudentId) {
          res.status(403).json({ error: "not your attempt" });
          return;
        }

        const choices = await listQuestionChoicesForAttempt(
          client,
          attemptRow.question_id,
        );
        const built = buildConfusionTagRows(
          choices,
          parse.data,
          attemptRow.selected_choice_id,
        );
        if (built.overlap.length > 0 || built.dropped.length > 0) {
          res.status(400).json({
            error:
              "confusion choice_ids must belong to the question and be disjoint",
            invalid: [...built.overlap, ...built.dropped],
          });
          return;
        }

        try {
          await client.query("BEGIN");
          await client.query(
            `DELETE FROM attempt_choice_tags WHERE attempt_id = $1`,
            [id],
          );
          await insertConfusionTagRows(
            client,
            id,
            attemptRow.question_id,
            parse.data.source,
            built.rows,
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK").catch(() => undefined);
          if (isMissingConfusionTable(err)) {
            res.json({
              ok: false,
              persisted: false,
              reason: "confusion_capture_not_provisioned",
            });
            return;
          }
          throw err;
        }

        res.json({
          ok: true,
          persisted: true,
          attempt_id: id,
          eliminated: built.rows
            .filter((r) => r.bucket === "eliminated")
            .map((r) => r.choice_id),
          deciding_between: built.rows
            .filter((r) => r.bucket === "deciding_between")
            .map((r) => r.choice_id),
          source: parse.data.source,
        });
      } catch (err) {
        console.error("[attempts confusion patch] failed:", err);
        res.status(500).json({ error: "internal server error" });
      } finally {
        client.release();
      }
    },
  );

  // Fire-and-forget dwell report. Arrives after the attempt POST because the
  // forensics panel opens after submit (spec §4). Absent dwell = skipped
  // forensics, which is itself signal — so failures here return errors but
  // clients treat the call as best-effort.
  app.patch("/api/attempts/:id/forensics-dwell", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid attempt id" });
      return;
    }
    const parse = forensicsDwellBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }
    try {
      const pool = getPool();
      const { rowCount } = await pool.query(
        `UPDATE student_attempts
            SET metadata = JSON_SET(metadata, '$.forensics_dwell_ms', $1)
          WHERE attempt_id = $2`,
        [parse.data.dwell_ms, id],
      );
      if (rowCount === 0) {
        res.status(404).json({ error: "attempt not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error("[attempts dwell] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}

// ── C3 SRS helpers ────────────────────────────────────────────────────────────

async function upsertSrsRow(
  studentId: string, moldCode: string, success: boolean, nowMs: number,
): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT reps, lapses, ease, interval_days, last_reviewed_ms, due_at_ms
       FROM student_c3_srs WHERE student_id = $1 AND mold_code = $2 LIMIT 1`,
    [studentId, moldCode],
  );
  const r = rows[0];
  const s: MoldSrs = r
    ? { reps: Number(r.reps), lapses: Number(r.lapses), ease: Number(r.ease),
        interval_days: Number(r.interval_days), last_reviewed_ms: Number(r.last_reviewed_ms),
        due_at_ms: Number(r.due_at_ms) }
    : fresh();
  if (success) applySuccess(s, nowMs);
  else applyLapse(s, nowMs);
  await pool.query(
    `INSERT INTO student_c3_srs
       (student_id, mold_code, reps, lapses, ease, interval_days, last_reviewed_ms, due_at_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON DUPLICATE KEY UPDATE
       reps = VALUES(reps), lapses = VALUES(lapses), ease = VALUES(ease),
       interval_days = VALUES(interval_days),
       last_reviewed_ms = VALUES(last_reviewed_ms),
       due_at_ms = VALUES(due_at_ms)`,
    [studentId, moldCode, s.reps, s.lapses, s.ease, s.interval_days, s.last_reviewed_ms, s.due_at_ms],
  );
}

async function updateC3SrsAsync(
  studentId: string, questionId: string, correct: boolean,
  bittenMold: string | null, nowMs: number,
): Promise<void> {
  try {
    if (correct) {
      const pool = getPool();
      const moldCodes = await listQuestionC3MoldCodesForAttempt(pool, questionId);
      await Promise.all(moldCodes.map((moldCode) => upsertSrsRow(studentId, moldCode, true, nowMs)));
    } else if (bittenMold) {
      await upsertSrsRow(studentId, bittenMold, false, nowMs);
    }
  } catch (err) {
    console.error("[c3-srs] background update failed:", err);
  }
}

function asStringArray(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}
