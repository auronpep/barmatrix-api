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

interface SubjectQuestionRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  tension_point: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_BY_SUBJECT_LIMIT = 25;
export const MAX_BY_SUBJECT_LIMIT = 100;

export interface BySubjectParams {
  subject: string | null;
  page: number;
  limit: number;
  offset: number;
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(raw)));
}

// Pure normalization for the by-subject list query. Exported so it can be unit
// tested without a live database (mirrors the knowledge route's helpers).
export function normalizeBySubjectParams(
  query: Record<string, unknown>,
): BySubjectParams {
  const subjectRaw = query.subject;
  const subject =
    typeof subjectRaw === "string" && subjectRaw.trim().length > 0
      ? subjectRaw.trim()
      : null;
  const page = clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(
    query.limit,
    DEFAULT_BY_SUBJECT_LIMIT,
    1,
    MAX_BY_SUBJECT_LIMIT,
  );
  return { subject, page, limit, offset: (page - 1) * limit };
}

export function registerQuestionsRoutes(app: Express): void {
  // IMPORTANT: register this BEFORE "/api/questions/:id". Express matches in
  // registration order, so the literal "by-subject" path must win over the
  // ":id" param route — otherwise "by-subject" is captured as :id and fails
  // the UUID check with 400 {"error":"invalid question id"}.
  app.get("/api/questions/by-subject", async (req: Request, res: Response) => {
    const { subject, page, limit, offset } = normalizeBySubjectParams(
      req.query as Record<string, unknown>,
    );
    if (!subject) {
      res.status(400).json({ error: "subject is required" });
      return;
    }

    try {
      const pool = getPool();
      const { rows } = await pool.query<SubjectQuestionRow>(
        `SELECT question_id, external_id, subject, topic, subtopic, tension_point
           FROM questions
          WHERE subject = $1 AND status = 'active'
          ORDER BY RAND()
          LIMIT $2 OFFSET $3`,
        [subject, limit, offset],
      );

      const { rows: countRows } = await pool.query<{ total: number | string }>(
        `SELECT COUNT(*) AS total
           FROM questions
          WHERE subject = $1 AND status = 'active'`,
        [subject],
      );
      const total = Number(countRows[0]?.total ?? 0);

      res.json({
        subject,
        page,
        limit,
        total,
        questions: rows.map((q) => ({
          question_id: q.question_id,
          external_id: q.external_id,
          subject: q.subject,
          topic: q.topic,
          subtopic: q.subtopic,
          tension_point: q.tension_point,
        })),
      });
    } catch (err) {
      console.error("[questions by-subject] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

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
