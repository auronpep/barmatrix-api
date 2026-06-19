// GET /api/questions/:id/answer-key — the post-answer debrief payload.
//
// Assembles the DebriefData the app's <AnswerKeyDebrief> ("Combo B · Fork-First")
// renders, from questions + answer_choices + c3_annotations. This is a POST-ANSWER
// surface, so unlike GET /api/questions/:id it intentionally reveals is_correct,
// why_*, and the c3 mold/filter classification.
//
// Read-only. Reachable by URL for review; NOT yet wired into the live runner.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  buildDebriefData,
  type AkQuestionRow,
  type AkChoiceRow,
  type AkAnnotationRow,
} from "../lib/answer-key-data.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMissingError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146 ||
                 e.code === "ER_BAD_FIELD_ERROR" || e.errno === 1054);
}

export function registerAnswerKeyRoutes(app: Express): void {
  app.get("/api/questions/:id/answer-key", clerkMiddleware(), async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid question id" });
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
      if (resolution.kind === "not_enrolled" || !resolution.student.enrolled) {
        res.status(403).json({ error: "enrollment required" });
        return;
      }

      const pool = getPool();
      const { rows: qrows } = await pool.query<AkQuestionRow>(
        `SELECT question_id, external_id, subject, topic, subtopic, tension_point,
                fact_pattern, question_stem, call_of_question, difficulty, metadata
           FROM questions
          WHERE question_id = $1 AND status IN ('active', 'diagnostic')
          LIMIT 1`,
        [id],
      );
      const q = qrows[0];
      if (!q) {
        res.status(404).json({ error: "question not found" });
        return;
      }

      const { rows: choiceRows } = await pool.query<AkChoiceRow>(
        `SELECT letter, choice_text, is_correct, why_attractive, why_wrong_or_correct,
                future_cue, remediation_id, forensic_tags, misconception_tags,
                c3_filter_broken, c3_mold_code, c3_architecture
           FROM answer_choices
          WHERE question_id = $1
          ORDER BY letter ASC`,
        [id],
      );

      // c3_annotations is optional — a question without one still gets a debrief.
      let ann: AkAnnotationRow | null = null;
      try {
        const { rows: annRows } = await pool.query<AkAnnotationRow>(
          `SELECT verdict, residual, agrees_with_key, governing_law_type, deciding_phase,
                  tension_axis_id, is_fork, fork_type, call_heuristic, difficulty, analyzer_notes
             FROM c3_annotations
            WHERE question_id = $1
            ORDER BY evolved_round DESC
            LIMIT 1`,
          [id],
        );
        ann = annRows[0] ?? null;
      } catch (annErr) {
        if (!isMissingError(annErr)) throw annErr;
      }

      res.json(buildDebriefData(q, choiceRows, ann));
    } catch (err) {
      console.error("[answer-key] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
