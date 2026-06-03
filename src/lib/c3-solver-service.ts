// DB service for the C3 solver/tagger (triage C2). Thin orchestration around the
// pure analyzer in c3-solver.ts. Scans UNTAGGED active questions, runs the
// analyzer, and enqueues every proposal to the review queue for a human to
// confirm. NEVER writes c3_annotations — the human gate promotes a proposal.
import { getPool } from "../db.js";
import {
  analyzeQuestion,
  validateProposal,
  type Letter,
  type SolverChoice,
  type SolverQuestion,
} from "./c3-solver.js";
import { enqueueReview, type ReviewReason } from "./review-queue.js";

export interface SolverRunSummary {
  scanned: number;
  proposed_pass: number;
  needs_human: number;
  defects: number;
  queued: number;
}

interface UntaggedRow {
  question_id: string;
  subject: string | null;
  question_stem: string | null;
  call_of_question: string | null;
}
interface ChoiceRow {
  letter: string;
  choice_text: string | null;
  is_correct: 0 | 1 | boolean;
}

const isLetter = (x: string): x is Letter => x === "A" || x === "B" || x === "C" || x === "D";
const truthy = (v: unknown): boolean => v === true || v === 1 || v === "1";

export async function runSolverOverUntagged(limit: number = 50): Promise<SolverRunSummary> {
  const pool = getPool();
  const cap = Math.max(1, Math.min(500, Math.floor(limit)));

  const untagged = await pool.query<UntaggedRow>(
    `SELECT q.question_id AS question_id, q.subject AS subject,
            q.question_stem AS question_stem, q.call_of_question AS call_of_question
       FROM questions q
       LEFT JOIN c3_annotations an ON an.question_id = q.question_id
      WHERE q.status = 'active' AND an.question_id IS NULL
      LIMIT $1`,
    [cap],
  );

  const summary: SolverRunSummary = { scanned: 0, proposed_pass: 0, needs_human: 0, defects: 0, queued: 0 };

  for (const q of untagged.rows) {
    summary.scanned++;
    const choicesR = await pool.query<ChoiceRow>(
      `SELECT letter, choice_text, is_correct FROM answer_choices WHERE question_id = $1 ORDER BY letter`,
      [q.question_id],
    );
    const choices: SolverChoice[] = [];
    let credited: Letter | null = null;
    let creditedCount = 0;
    for (const c of choicesR.rows) {
      if (!isLetter(c.letter)) continue;
      choices.push({ letter: c.letter, text: c.choice_text ?? "" });
      if (truthy(c.is_correct)) { credited = c.letter; creditedCount++; }
    }

    // No single credited answer -> structural defect; route to human, don't analyze.
    if (creditedCount !== 1 || credited == null) {
      summary.defects++;
      const r = await enqueueReview(pool, {
        question_id: q.question_id, reason: "DEFECT", priority: 2,
        details: { source: "solver", note: `expected exactly 1 credited choice, found ${creditedCount}` },
      });
      if (r.queued) summary.queued++;
      continue;
    }

    const proposal = analyzeQuestion({
      subject: q.subject, stem: q.question_stem, call: q.call_of_question,
      choices, credited_answer: credited,
    } satisfies SolverQuestion);
    const validation = validateProposal(proposal);

    let reason: ReviewReason;
    let priority: number;
    if (proposal.verdict === "PASS" && validation.valid) {
      summary.proposed_pass++;
      reason = "NEEDS_HUMAN"; // a proposed annotation awaiting human confirmation
      priority = 6; // low: quick confirm
    } else {
      summary.needs_human++;
      reason = "NEEDS_HUMAN";
      priority = 4;
    }

    const r = await enqueueReview(pool, {
      question_id: q.question_id, reason, priority,
      details: { source: "solver", proposed_verdict: proposal.verdict, proposal, validation },
    });
    if (r.queued) summary.queued++;
  }

  return summary;
}
