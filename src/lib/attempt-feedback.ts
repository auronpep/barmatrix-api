import { randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";

type Queryable = Pick<DbPool, "query">;

export interface RecordAttemptFeedbackInput {
  feedbackId?: string;
  studentId: string;
  attemptEventId: string;
  eliminatedChoices: readonly string[];
  strugglePair?: readonly string[] | null;
  whySelected?: string | null;
  skipped?: boolean;
}

export interface RecordAttemptFeedbackResult {
  feedback_id: string;
}

interface AttemptOwnerRow {
  attempt_event_id: string;
}

async function attemptBelongsToStudent(
  db: Queryable,
  input: { studentId: string; attemptEventId: string },
): Promise<boolean> {
  const { rows } = await db.query<AttemptOwnerRow>(
    `SELECT attempt_event_id
       FROM (
         SELECT attempt_event_id
           FROM leadme_submissions
          WHERE attempt_event_id = $1 AND student_id = $2
         UNION ALL
         SELECT attempt_event_id
           FROM attempt_telemetry_ext
          WHERE attempt_event_id = $1 AND student_id = $2
         UNION ALL
         SELECT attempt_id AS attempt_event_id
           FROM student_attempts
          WHERE attempt_id = $1 AND student_id = $2
       ) owned_attempts
      LIMIT 1`,
    [input.attemptEventId, input.studentId],
  );
  return rows.length > 0;
}

export async function recordAttemptFeedback(
  db: Queryable,
  input: RecordAttemptFeedbackInput,
): Promise<RecordAttemptFeedbackResult | null> {
  const owned = await attemptBelongsToStudent(db, {
    studentId: input.studentId,
    attemptEventId: input.attemptEventId,
  });
  if (!owned) return null;

  const feedbackId = input.feedbackId ?? randomUUID();
  await db.query(
    `INSERT INTO attempt_feedback
       (feedback_id, attempt_event_id, student_id, eliminated_choices_json,
        struggle_pair_json, why_selected, skipped)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      feedbackId,
      input.attemptEventId,
      input.studentId,
      JSON.stringify(input.eliminatedChoices),
      input.strugglePair ? JSON.stringify(input.strugglePair) : null,
      input.whySelected ?? null,
      input.skipped ? 1 : 0,
    ],
  );
  return { feedback_id: feedbackId };
}
