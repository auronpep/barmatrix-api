// DB service for per-item live psychometrics (triage A4). Thin orchestration
// around the pure compute in c3-item-stats.ts: gather attempts, compute stats,
// upsert item_live_stats, and enqueue auto-review triggers. Pure logic is unit-
// tested; this layer is integration-only.
import { getPool } from "../db.js";
import {
  computeItemStats,
  reviewReasonForStats,
  type ItemAttempt,
} from "./c3-item-stats.js";
import { enqueueReview } from "./review-queue.js";

export const DEFAULT_COHORT = "launch";

export interface RecomputeSummary {
  cohort_id: string;
  items_updated: number;
  queued: number;
}

interface AttemptRow {
  question_id: string;
  student_id: string;
  correct: 0 | 1 | boolean;
  selected_letter: string | null;
  flagged: 0 | 1 | boolean | null;
  time_seconds: number | null;
  credited_letter: string | null;
}

// Real (non-anonymous) attempts on active questions, joined to the credited
// letter. `flagged` may not exist pre-migration; fall back to 0 in that case.
function attemptsSql(withFlagged: boolean): string {
  const flaggedExpr = withFlagged ? "a.flagged" : "0";
  return `
    SELECT a.question_id AS question_id, a.student_id AS student_id, a.correct AS correct,
           a.selected_letter AS selected_letter, ${flaggedExpr} AS flagged,
           a.time_seconds AS time_seconds, cc.letter AS credited_letter
      FROM student_attempts a
      JOIN students s ON s.student_id = a.student_id AND s.status <> 'anonymous'
      JOIN questions q ON q.question_id = a.question_id AND q.status = 'active'
      LEFT JOIN ( SELECT question_id, letter FROM answer_choices WHERE is_correct = 1 ) cc
        ON cc.question_id = a.question_id`;
}

function isMissingFieldError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_BAD_FIELD_ERROR" || e.errno === 1054);
}

const truthy = (v: unknown): boolean => v === true || v === 1 || v === "1";

export async function recomputeCohortItemStats(cohortId: string = DEFAULT_COHORT): Promise<RecomputeSummary> {
  const pool = getPool();

  // 1. Per-student ability = overall p_correct (continuous proxy for discrimination).
  const abilityR = await pool.query<{ student_id: string; ability: number | string }>(
    `SELECT a.student_id AS student_id, AVG(a.correct) AS ability
       FROM student_attempts a
       JOIN students s ON s.student_id = a.student_id AND s.status <> 'anonymous'
      GROUP BY a.student_id`,
  );
  const ability = new Map<string, number>();
  for (const r of abilityR.rows) ability.set(r.student_id, Number(r.ability));

  // 2. All scored attempts (flagged-tolerant).
  let rows: AttemptRow[];
  try {
    rows = (await pool.query<AttemptRow>(attemptsSql(true))).rows;
  } catch (err) {
    if (!isMissingFieldError(err)) throw err;
    rows = (await pool.query<AttemptRow>(attemptsSql(false))).rows;
  }

  // 3. Group by question.
  const byQuestion = new Map<string, { credited: string | null; attempts: ItemAttempt[] }>();
  for (const r of rows) {
    let bucket = byQuestion.get(r.question_id);
    if (!bucket) {
      bucket = { credited: r.credited_letter, attempts: [] };
      byQuestion.set(r.question_id, bucket);
    }
    bucket.attempts.push({
      studentAbility: ability.get(r.student_id) ?? 0,
      correct: truthy(r.correct),
      selectedLetter: r.selected_letter,
      flagged: truthy(r.flagged),
      timeMs: r.time_seconds == null ? null : r.time_seconds * 1000,
    });
  }

  // 4. Compute, upsert, enqueue triggers.
  let itemsUpdated = 0;
  let queued = 0;
  for (const [questionId, { credited, attempts }] of byQuestion) {
    const stats = computeItemStats(attempts, credited);
    await pool.query(
      `INSERT INTO item_live_stats
         (question_id, cohort_id, n_attempts, p_correct, discrimination, mean_time_ms, flag_rate, distractor_pull)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON DUPLICATE KEY UPDATE
         n_attempts = VALUES(n_attempts), p_correct = VALUES(p_correct),
         discrimination = VALUES(discrimination), mean_time_ms = VALUES(mean_time_ms),
         flag_rate = VALUES(flag_rate), distractor_pull = VALUES(distractor_pull)`,
      [
        questionId, cohortId, stats.n_attempts, stats.p_correct, stats.discrimination,
        stats.mean_time_ms, stats.flag_rate, JSON.stringify(stats.distractor_pull),
      ],
    );
    itemsUpdated++;

    const reason = reviewReasonForStats(stats);
    if (reason) {
      const r = await enqueueReview(pool, {
        question_id: questionId,
        reason,
        priority: 3,
        details: { source: "item_live_stats", cohort_id: cohortId, stats },
      });
      if (r.queued) queued++;
    }
  }

  return { cohort_id: cohortId, items_updated: itemsUpdated, queued };
}
