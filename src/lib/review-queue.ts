// Admin human-review queue (triage A3). Shared by the item-stats recompute (A4)
// and the solver/tagger (C2), which enqueue items for a human to gate.
//
// Pure validators are unit-tested; enqueueReview does idempotent DB I/O against
// the db.ts pool shape ({ query -> { rows, rowCount } }).
import { randomUUID } from "node:crypto";

export const REVIEW_REASONS = [
  "NEEDS_HUMAN",
  "DEFECT",
  "LOW_DISCRIMINATION",
  "HIGH_FLAG_RATE",
  "DISTRACTOR_PULL",
  "LEGAL_REVIEW",
  "COPYRIGHT_REVIEW",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const REVIEW_STATUSES = ["queued", "assigned", "resolved", "retired", "blocked"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Statuses that close a review item (set resolved_at, free it from "open").
export const TERMINAL_STATUSES: readonly ReviewStatus[] = ["resolved", "retired", "blocked"];

export function isReviewReason(x: unknown): x is ReviewReason {
  return typeof x === "string" && (REVIEW_REASONS as readonly string[]).includes(x);
}
export function isReviewStatus(x: unknown): x is ReviewStatus {
  return typeof x === "string" && (REVIEW_STATUSES as readonly string[]).includes(x);
}
export function isTerminalStatus(s: ReviewStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}

// Minimal DB surface (matches db.ts getPool()/client). $n placeholders.
export interface ReviewDb {
  query<T = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number }>;
}

export interface EnqueueInput {
  question_id: string;
  reason: ReviewReason;
  priority?: number; // default 5
  details?: unknown; // serialized to JSON
}

export interface EnqueueResult {
  queued: boolean; // false = skipped (an open row for this question+reason already exists)
  review_id?: string;
}

/**
 * Idempotently enqueue a review item. Skips when an OPEN (non-terminal) row for
 * the same (question_id, reason) already exists, so repeated recompute/solver
 * runs don't pile up duplicates.
 */
export async function enqueueReview(db: ReviewDb, input: EnqueueInput): Promise<EnqueueResult> {
  const terminalList = TERMINAL_STATUSES.map((s) => `'${s}'`).join(",");
  const existing = await db.query<{ review_id: string }>(
    `SELECT review_id FROM review_queue
      WHERE question_id = $1 AND reason = $2 AND status NOT IN (${terminalList})
      LIMIT 1`,
    [input.question_id, input.reason],
  );
  if (existing.rows.length > 0) {
    return { queued: false, review_id: existing.rows[0]!.review_id };
  }
  const reviewId = randomUUID();
  await db.query(
    `INSERT INTO review_queue (review_id, question_id, reason, status, priority, details)
     VALUES ($1, $2, $3, 'queued', $4, $5)`,
    [
      reviewId,
      input.question_id,
      input.reason,
      input.priority ?? 5,
      input.details == null ? null : JSON.stringify(input.details),
    ],
  );
  return { queued: true, review_id: reviewId };
}
