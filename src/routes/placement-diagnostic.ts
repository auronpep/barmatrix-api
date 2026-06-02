// C3 placement diagnostic compatibility routes.
//
// The frontend placement flow is intentionally layered on the existing
// anonymous-safe diagnostic attempt storage: each placement session is just a
// diagnostic set_id with 18 pinned question IDs and placement-shaped scoring.

import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool, type DbClient } from "../db.js";
import {
  DIAGNOSTIC_POOL_SIZE,
  selectDiagnosticQuestionIds,
  type DiagnosticCandidate,
} from "../lib/diagnostic.js";
import { findSelectedChoiceForAttempt } from "./attempts.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS_GROUP_MIN_SAMPLE = 30;
export const PLACEMENT_LENGTH = 18;
const PLACEMENT_MODEL = "c3-placement-v1";

type Letter = "A" | "B" | "C" | "D";

const attemptBody = z.object({
  question_id: z.string().uuid(),
  selected_letter: z.enum(["A", "B", "C", "D"]),
  confidence: z.number().int().min(0).max(100),
  time_seconds: z.number().int().min(0),
  mechanism: z.enum([
    "CUT_MISSTATE",
    "CUT_WRONG_Q",
    "CLASH",
    "CALL",
    "ANCHOR",
    "FORK",
  ]),
});

interface QuestionRefRow {
  question_id: string;
  subject: string | null;
  attractiveness: number | string | null;
}

interface PlacementQuestionRow {
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

interface PlacementChoiceRow {
  choice_id: string;
  question_id: string;
  letter: Letter;
  choice_text: string;
}

interface CorrectChoiceRow {
  letter: Letter;
  choice_text: string;
  why_wrong_or_correct: string | null;
}

interface SelectedChoiceCopyRow {
  why_wrong_or_correct: string | null;
}

export interface PlacementAttemptScore {
  legalScore: number;
  mechanismScore: number;
  calibrationScore: number;
}

export interface PlacementResultRow {
  correct: boolean | 0 | 1;
  subject: string | null;
  subtopic: string | null;
  remediation_id: string | null;
  placement_legal_score?: number | null;
  placement_mechanism_score?: number | null;
  placement_calibration_score?: number | null;
}

interface PlacementAttemptQueryRow extends PlacementResultRow {
  metadata: unknown;
}

export function confidencePctToBand(value: number): number {
  if (!Number.isFinite(value)) return 3;
  if (value <= 20) return 1;
  if (value <= 40) return 2;
  if (value <= 60) return 3;
  if (value <= 80) return 4;
  return 5;
}

function isCorrect(value: boolean | 0 | 1): boolean {
  return value === true || value === 1;
}

export function scorePlacementAttempt(input: {
  correct: boolean;
  confidencePct: number;
}): PlacementAttemptScore {
  const confident = input.confidencePct >= 60;
  const lowConfidence = input.confidencePct <= 40;
  return {
    legalScore: input.correct ? 1 : 0,
    // Mechanism keys are not provisioned in the live bank yet. Until they are,
    // give credit only when the legal answer is right; still persist the chosen
    // mechanism in metadata so future scoring can be upgraded without data loss.
    mechanismScore: input.correct ? 1 : 0,
    calibrationScore:
      (input.correct && confident) || (!input.correct && lowConfidence) ? 1 : 0,
  };
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numberFromMetadata(
  metadata: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const raw = metadata[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function withPlacementScores(row: PlacementAttemptQueryRow): PlacementResultRow {
  const metadata = parseMetadata(row.metadata);
  const fallbackLegal = isCorrect(row.correct) ? 1 : 0;
  return {
    correct: row.correct,
    subject: row.subject,
    subtopic: row.subtopic,
    remediation_id: row.remediation_id,
    placement_legal_score: numberFromMetadata(
      metadata,
      "placement_legal_score",
      fallbackLegal,
    ),
    placement_mechanism_score: numberFromMetadata(
      metadata,
      "placement_mechanism_score",
      fallbackLegal,
    ),
    placement_calibration_score: numberFromMetadata(
      metadata,
      "placement_calibration_score",
      0,
    ),
  };
}

function levelForScore(totalScore: number, attempts: number): {
  level: number;
  label: string;
  description: string;
  route: string[];
} {
  const max = Math.max(1, attempts * 3);
  const pct = totalScore / max;
  if (pct >= 0.85) {
    return {
      level: 4,
      label: "L4 · Exam-ready refinement",
      description: "You are showing strong accuracy, mechanism recognition, and calibration. Start with timed refinement and red-zone cleanup.",
      route: ["Timed refinement", "Red-zone repair", "Certification practice"],
    };
  }
  if (pct >= 0.68) {
    return {
      level: 3,
      label: "L3 · Targeted repair",
      description: "You have the core approach. Your best return is targeted work on the traps surfaced by this placement.",
      route: ["Red-zone repair", "C3 calibration", "Mixed timed sets"],
    };
  }
  if (pct >= 0.5) {
    return {
      level: 2,
      label: "L2 · Build the method",
      description: "You have enough traction to start applying the method, but the placement shows recurring misses to repair.",
      route: ["The Method", "Foundational drills", "Red-zone repair"],
    };
  }
  if (pct >= 0.3) {
    return {
      level: 1,
      label: "L1 · Method foundations",
      description: "Start with the core C3 workflow before pushing timed mixed practice.",
      route: ["The Method", "Untimed subject drills", "Confidence calibration"],
    };
  }
  return {
    level: 0,
    label: "L0 · Start from first principles",
    description: "Begin with the foundations so the later repair work has a stable base.",
    route: ["The Method", "Foundational rule work", "Short untimed sets"],
  };
}

export function shapePlacementResults(rows: PlacementResultRow[]) {
  const attempts = rows.length;
  const legalScore = rows.reduce(
    (sum, row) => sum + (row.placement_legal_score ?? (isCorrect(row.correct) ? 1 : 0)),
    0,
  );
  const mechanismScore = rows.reduce(
    (sum, row) => sum + (row.placement_mechanism_score ?? (isCorrect(row.correct) ? 1 : 0)),
    0,
  );
  const calibrationScore = rows.reduce(
    (sum, row) => sum + (row.placement_calibration_score ?? 0),
    0,
  );
  const totalScore = legalScore + mechanismScore + calibrationScore;

  const subjectMap = new Map<string, { subject: string; correct: number; total: number }>();
  const targetMap = new Map<string, { subject: string; label: string; count: number }>();
  for (const row of rows) {
    const subject = row.subject ?? "Unknown";
    const current = subjectMap.get(subject) ?? { subject, correct: 0, total: 0 };
    current.total += 1;
    if (isCorrect(row.correct)) current.correct += 1;
    subjectMap.set(subject, current);

    if (!isCorrect(row.correct)) {
      const label = row.subtopic ?? row.remediation_id ?? "General review";
      const key = `${subject}:${label}`;
      const target = targetMap.get(key) ?? { subject, label, count: 0 };
      target.count += 1;
      targetMap.set(key, target);
    }
  }

  const level = levelForScore(totalScore, attempts);
  return {
    placement_level: level.level,
    placement_label: level.label,
    placement_description: level.description,
    entry_route: level.route,
    subject_accuracy: [...subjectMap.values()].sort((a, b) =>
      a.subject.localeCompare(b.subject),
    ),
    top_remediation_targets: [...targetMap.values()]
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject))
      .slice(0, 5)
      .map(({ subject, label }) => ({ subject, label })),
    total_score: totalScore,
    legal_score: legalScore,
    mechanism_score: mechanismScore,
    calibration_score: calibrationScore,
    attempts_so_far: attempts,
  };
}

function idPlaceholders(ids: string[], offset = 1): string {
  return ids.map((_, index) => `$${index + offset}`).join(", ");
}

async function selectPlacementQuestionIds(
  client: Pick<DbClient, "query">,
): Promise<string[]> {
  try {
    const { rows } = await client.query<QuestionRefRow>(
      `SELECT q.question_id, q.subject,
              CASE
                WHEN fg.sample_size >= $1 THEN GREATEST(
                  CASE WHEN cc.letter = 'A' THEN -1 ELSE COALESCE(fg.pct_a, 0) END,
                  CASE WHEN cc.letter = 'B' THEN -1 ELSE COALESCE(fg.pct_b, 0) END,
                  CASE WHEN cc.letter = 'C' THEN -1 ELSE COALESCE(fg.pct_c, 0) END,
                  CASE WHEN cc.letter = 'D' THEN -1 ELSE COALESCE(fg.pct_d, 0) END
                )
                ELSE 0
              END AS attractiveness
         FROM questions q
         LEFT JOIN focus_group_response_data fg ON fg.question_id = q.question_id
         LEFT JOIN answer_choices cc
           ON cc.question_id = q.question_id AND cc.is_correct = 1
        WHERE q.status = 'active'
        ORDER BY attractiveness DESC, RAND()
        LIMIT $2`,
      [FOCUS_GROUP_MIN_SAMPLE, DIAGNOSTIC_POOL_SIZE],
    );
    return selectDiagnosticQuestionIds(
      rows.map((row): DiagnosticCandidate => ({
        question_id: row.question_id,
        subject: row.subject,
        attractiveness: Number(row.attractiveness) || 0,
      })),
      PLACEMENT_LENGTH,
    );
  } catch (err) {
    console.error("[placement diagnostic] weighted pick failed:", err);
  }

  const { rows } = await client.query<QuestionRefRow>(
    `SELECT q.question_id, q.subject, 0 AS attractiveness
       FROM questions q
      WHERE q.status = 'active'
      ORDER BY RAND()
      LIMIT $1`,
    [PLACEMENT_LENGTH],
  );
  return rows.map((row) => row.question_id);
}

async function loadPlacementQuestions(
  client: Pick<DbClient, "query">,
  questionIds: string[],
) {
  if (questionIds.length === 0) return [];
  const placeholders = idPlaceholders(questionIds);
  const { rows: questionRows } = await client.query<PlacementQuestionRow>(
    `SELECT question_id, external_id, subject, topic, subtopic, tension_point,
            fact_pattern, question_stem, call_of_question
       FROM questions
      WHERE status = 'active' AND question_id IN (${placeholders})`,
    questionIds,
  );
  const { rows: choiceRows } = await client.query<PlacementChoiceRow>(
    `SELECT choice_id, question_id, letter, choice_text
       FROM answer_choices
      WHERE question_id IN (${placeholders})
      ORDER BY question_id ASC, letter ASC`,
    questionIds,
  );
  const choicesByQuestion = new Map<string, PlacementChoiceRow[]>();
  for (const choice of choiceRows) {
    const choices = choicesByQuestion.get(choice.question_id) ?? [];
    choices.push(choice);
    choicesByQuestion.set(choice.question_id, choices);
  }
  const byId = new Map(questionRows.map((row) => [row.question_id, row]));
  return questionIds
    .map((id) => byId.get(id))
    .filter((row): row is PlacementQuestionRow => Boolean(row))
    .map((question) => ({
      question_id: question.question_id,
      external_id: question.external_id,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic,
      tension_point: question.tension_point,
      fact_pattern: question.fact_pattern,
      question_stem: question.question_stem,
      call_of_question: question.call_of_question,
      choices: (choicesByQuestion.get(question.question_id) ?? []).map((choice) => ({
        choice_id: choice.choice_id,
        letter: choice.letter,
        choice_text: choice.choice_text,
      })),
    }));
}

async function getAnonymousPlacementStudent(
  client: Pick<DbClient, "query">,
  sessionId: string,
): Promise<string> {
  const email = `anon-placement-${sessionId}@barmatrix.local`;
  await client.query(
    `INSERT INTO students (email, full_name, status, consent_flags)
          VALUES ($1, 'Anonymous placement', 'anonymous', JSON_OBJECT('anonymous', true, 'placement', true))
     ON DUPLICATE KEY UPDATE status = status`,
    [email],
  );
  const { rows } = await client.query<{ student_id: string }>(
    "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
    [email],
  );
  const id = rows[0]?.student_id ?? null;
  if (!id) throw new Error("failed to allocate placement student");
  return id;
}

function assertSessionId(req: Request, res: Response): string | null {
  const sessionId = req.params.id;
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    res.status(400).json({ error: "invalid placement session id" });
    return null;
  }
  return sessionId;
}

export function registerPlacementDiagnosticRoutes(app: Express): void {
  app.post("/api/diagnostic/session/start", async (_req, res) => {
    try {
      const pool = getPool();
      const questionIds = await selectPlacementQuestionIds(pool);
      res.json({
        session_id: randomUUID(),
        question_count: questionIds.length,
        question_ids: questionIds,
        placement_model: PLACEMENT_MODEL,
      });
    } catch (err) {
      console.error("[placement diagnostic start] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/diagnostic/questions", async (_req, res) => {
    try {
      const pool = getPool();
      const questionIds = await selectPlacementQuestionIds(pool);
      const questions = await loadPlacementQuestions(pool, questionIds);
      res.json({ questions, question_count: questions.length });
    } catch (err) {
      console.error("[placement diagnostic questions] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post("/api/diagnostic/session/:id/attempt", async (req, res) => {
    const sessionId = assertSessionId(req, res);
    if (!sessionId) return;
    const parse = attemptBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }
    const body = parse.data;
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const selected = await findSelectedChoiceForAttempt(
        client,
        body.question_id,
        body.selected_letter,
      );
      if (!selected) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "selected choice not found" });
        return;
      }
      const selectedCorrect = selected.is_correct === true || selected.is_correct === 1;
      const score = scorePlacementAttempt({
        correct: selectedCorrect,
        confidencePct: body.confidence,
      });
      const { rows: correctRows } = await client.query<CorrectChoiceRow>(
        `SELECT letter, choice_text, why_wrong_or_correct
           FROM answer_choices
          WHERE question_id = $1 AND is_correct = 1
          LIMIT 1`,
        [body.question_id],
      );
      const correct = correctRows[0] ?? null;
      const { rows: selectedCopyRows } = await client.query<SelectedChoiceCopyRow>(
        `SELECT why_wrong_or_correct
           FROM answer_choices
          WHERE question_id = $1 AND letter = $2
          LIMIT 1`,
        [body.question_id, body.selected_letter],
      );
      const studentId = await getAnonymousPlacementStudent(client, sessionId);
      const attemptId = randomUUID();
      const metadata = JSON.stringify({
        anonymous: true,
        placement: true,
        placement_model: PLACEMENT_MODEL,
        placement_confidence_pct: body.confidence,
        placement_mechanism: body.mechanism,
        placement_legal_score: score.legalScore,
        placement_mechanism_score: score.mechanismScore,
        placement_calibration_score: score.calibrationScore,
      });
      await client.query(
        `INSERT INTO student_attempts
           (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
            correct, confidence, time_seconds, platform, set_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'web', $9, $10)`,
        [
          attemptId,
          studentId,
          body.question_id,
          selected.choice_id,
          body.selected_letter,
          selectedCorrect,
          confidencePctToBand(body.confidence),
          body.time_seconds,
          sessionId,
          metadata,
        ],
      );
      const { rows: scoreRows } = await client.query<PlacementAttemptQueryRow>(
        `SELECT a.correct, a.metadata, q.subject, q.subtopic, ac.remediation_id
           FROM student_attempts a
           JOIN questions q ON q.question_id = a.question_id
           LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
          WHERE a.set_id = $1
          ORDER BY a.attempted_at ASC`,
        [sessionId],
      );
      await client.query("COMMIT");
      const shaped = shapePlacementResults(scoreRows.map(withPlacementScores));
      res.json({
        is_correct: selectedCorrect,
        correct_letter: correct?.letter ?? null,
        correct_text: correct?.choice_text ?? "",
        why_wrong_or_correct:
          selectedCopyRows[0]?.why_wrong_or_correct ??
          correct?.why_wrong_or_correct ??
          "",
        remediation_id: selected.remediation_id,
        legal_score: score.legalScore,
        mechanism_score: score.mechanismScore,
        calibration_score: score.calibrationScore,
        session_score_so_far: shaped.total_score,
        attempts_so_far: shaped.attempts_so_far,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[placement diagnostic attempt] failed:", err);
      res.status(500).json({ error: "internal server error" });
    } finally {
      client.release();
    }
  });

  app.get("/api/diagnostic/session/:id/results", async (req, res) => {
    const sessionId = assertSessionId(req, res);
    if (!sessionId) return;
    try {
      const { rows } = await getPool().query<PlacementAttemptQueryRow>(
        `SELECT a.correct, a.metadata, q.subject, q.subtopic, ac.remediation_id
           FROM student_attempts a
           JOIN questions q ON q.question_id = a.question_id
           LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
          WHERE a.set_id = $1
          ORDER BY a.attempted_at ASC`,
        [sessionId],
      );
      res.json(shapePlacementResults(rows.map(withPlacementScores)));
    } catch (err) {
      console.error("[placement diagnostic results] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
