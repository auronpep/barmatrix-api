// POST /api/attempts        — record an answer, update red-zones, queue drill
// GET  /api/attempts/:id/forensics — hydrate the Wrong Answer Forensics card
//
// student_id is optional. When absent we mint an anonymous students row keyed
// on email anon-{set_id}@barmatrix.local so all attempts in the same
// diagnostic session attach to one synthetic student. Anonymous attempts skip
// red-zone updates and drill assignments.

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { kebabToTitle, snakeToTitle } from "../lib/format.js";
import {
  QUESTION_DIMENSION_COLUMNS,
  upsertColumnDerivedRedZone,
  type RedZoneUpdate,
} from "../lib/redzones.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Per SRC-0007 CLAIMS_SIGNOFF: never publish focus-group data below n=30.
const FOCUS_GROUP_MIN_SAMPLE = 30;

const attemptBody = z.object({
  question_id: z.string().uuid(),
  selected_letter: z.enum(["A", "B", "C", "D"]),
  confidence: z.number().int().min(1).max(5),
  time_seconds: z.number().int().min(0),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  set_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
});

interface QuestionForAttempt {
  question_id: string;
  subject: string;
  subtopic: string | null;
  tension_point: string | null;
}

interface ChoiceForAttempt {
  choice_id: string;
  is_correct: boolean;
  remediation_id: string | null;
}

interface CorrectChoice {
  letter: "A" | "B" | "C" | "D";
}

interface AnonStudent {
  student_id: string;
}

interface AttemptInsertRow {
  attempt_id: string;
}

export function registerAttemptsRoutes(app: Express): void {
  app.post("/api/attempts", async (req: Request, res: Response) => {
    const parse = attemptBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }
    const body = parse.data;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Resolve the selected choice to compute correctness + remediation.
      const { rows: selectedRows } = await client.query<ChoiceForAttempt>(
        `SELECT choice_id, is_correct, remediation_id
           FROM answer_choices
          WHERE question_id = $1 AND letter = $2
          LIMIT 1`,
        [body.question_id, body.selected_letter],
      );
      const selected = selectedRows[0];
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
          WHERE question_id = $1 AND is_correct = TRUE
          LIMIT 1`,
        [body.question_id],
      );
      const correctAnswer = correctRows[0]?.letter ?? null;

      // 2. Resolve student_id. If the caller passed one, use it. Otherwise
      // create-or-reuse a synthetic anonymous students row keyed by set_id
      // so a multi-question diagnostic session attaches to one row.
      let studentId = body.student_id ?? null;
      const isAnonymous = studentId === null;
      if (studentId === null) {
        const anonEmail = body.set_id
          ? `anon-${body.set_id}@barmatrix.local`
          : `anon-${crypto.randomUUID()}@barmatrix.local`;
        const { rows: anonRows } = await client.query<AnonStudent>(
          `INSERT INTO students (email, full_name, status, consent_flags)
                VALUES ($1, 'Anonymous diagnostic', 'anonymous', '{"anonymous": true}'::jsonb)
           ON CONFLICT (email) DO UPDATE SET status = students.status
           RETURNING student_id`,
          [anonEmail],
        );
        studentId = anonRows[0]?.student_id ?? null;
        if (studentId === null) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "failed to allocate anonymous student" });
          return;
        }
      }

      // 3. Insert the attempt.
      const { rows: attemptRows } = await client.query<AttemptInsertRow>(
        `INSERT INTO student_attempts
           (student_id, question_id, selected_choice_id, selected_letter,
            correct, confidence, time_seconds, platform, set_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING attempt_id`,
        [
          studentId,
          body.question_id,
          selected.choice_id,
          body.selected_letter,
          selected.is_correct,
          body.confidence,
          body.time_seconds,
          body.platform,
          body.set_id ?? null,
          isAnonymous ? '{"anonymous": true}' : "{}",
        ],
      );
      const attemptId = attemptRows[0]?.attempt_id;
      if (!attemptId) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: "failed to persist attempt" });
        return;
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

        if (!selected.is_correct && selected.remediation_id) {
          await client.query(
            `INSERT INTO drill_assignments
               (student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, question_ids, status)
             VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::uuid[], 'prescribed')`,
            [
              studentId,
              selected.remediation_id,
              "wrong_answer_forensics",
              "subtopic",
              q?.subtopic ?? "",
              body.question_id,
            ],
          );
        }
      }

      await client.query("COMMIT");

      res.json({
        attempt_id: attemptId,
        correct: selected.is_correct,
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
      attempt_correct: boolean;
      selected_letter: "A" | "B" | "C" | "D";
      selected_forensic_tags: string[] | null;
      selected_misconception_tags: string[] | null;
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

      if (r.attempt_correct) {
        res.json({
          correct: true,
          why_correct: r.selected_why_wrong_or_correct ?? "",
          focus_group: focusGroup,
        });
        return;
      }

      // Wrong answer: derive trap_name from the first non-meta forensic tag,
      // falling back to the question's subtopic.
      const forensicTags = r.selected_forensic_tags ?? [];
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
}
