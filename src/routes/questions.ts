// GET /api/questions/:id — fetch one question + its public choice payload.
//
// CRITICAL: never include is_correct, why_*, forensic_tags, or
// misconception_tags in the response. Those fields belong only to the
// forensics endpoint after a student submits an attempt.

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

interface QuestionRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  tension_point: string | null;
  fact_pattern: string;
  question_stem: string;
  call_of_question: string | null;
}

interface ChoiceRow {
  choice_id: string;
  letter: "A" | "B" | "C" | "D";
  choice_text: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerQuestionsRoutes(app: Express): void {
  app.get("/api/questions/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid question id" });
      return;
    }

    try {
      const pool = getPool();
      const { rows: qrows } = await pool.query<QuestionRow>(
        `SELECT question_id, external_id, subject, topic, subtopic, tension_point,
                fact_pattern, question_stem, call_of_question
           FROM questions
          WHERE question_id = $1 AND status = 'active'
          LIMIT 1`,
        [id],
      );
      const q = qrows[0];
      if (!q) {
        res.status(404).json({ error: "question not found" });
        return;
      }

      const { rows: choiceRows } = await pool.query<ChoiceRow>(
        `SELECT choice_id, letter, choice_text
           FROM answer_choices
          WHERE question_id = $1
          ORDER BY letter ASC`,
        [id],
      );

      res.json({
        question_id: q.question_id,
        external_id: q.external_id,
        subject: q.subject,
        topic: q.topic,
        subtopic: q.subtopic,
        tension_point: q.tension_point,
        fact_pattern: q.fact_pattern,
        question_stem: q.question_stem,
        call_of_question: q.call_of_question,
        choices: choiceRows.map((c) => ({
          choice_id: c.choice_id,
          letter: c.letter,
          choice_text: c.choice_text,
        })),
      });
    } catch (err) {
      console.error("[questions get] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
