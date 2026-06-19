import { createHash, randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";
import type {
  LeadMeSubmissionRecord,
  LeadMeSubmitResult,
  ServedLeadMeSnapshot,
} from "./leadme-submit.js";

type Queryable = Pick<DbPool, "query">;

interface LeadMeSubmissionRow {
  student_id: string;
  queue_entry_id: string;
  idempotency_key: string;
  attempt_event_id: string | null;
  response_payload_json: string | null;
}

export interface ReadLeadMeSubmissionInput {
  studentId: string;
  queueEntryId: string;
  idempotencyKey: string;
}

export interface RecordLeadMeSubmissionInput {
  submissionId?: string;
  studentId: string;
  idempotencyKey: string;
  attemptEventId: string | null;
  result: LeadMeSubmitResult;
}

export interface RecordLeadMeSubmissionResult {
  inserted: boolean;
  submission_id: string | null;
  attempt_event_id: string | null;
  result: LeadMeSubmitResult;
}

export interface LeadMeQueueProgressInput {
  eventId?: string;
  studentId: string;
  queueEntryId: string;
  itemId?: string | null;
  setId?: string | null;
  timeSpentSec?: number | null;
}

export interface LeadMeSetSummary {
  set_id: string;
  title: string;
  set_type: string;
  status: string;
  total_items: number;
  completed_items: number;
  active_items: number;
  pending_items: number;
}

export interface EnqueueLeadMeSetResult {
  set_id: string;
  title: string;
  set_type: string;
  status: string;
  total_items: number;
  inserted_items: number;
}

interface LeadMeSetSummaryRow {
  set_id: string;
  title: string;
  set_type: string;
  status: string;
  total_items: number | string;
  completed_items: number | string;
  active_items: number | string;
}

interface EnqueueLeadMeSetRow {
  set_id: string;
  title: string;
  set_type: string;
  status: string;
  total_items: number | string;
}

interface OutlineLeadMeSetRow {
  set_id: string;
}

function mysqlDateTime(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 19).replace("T", " ");
}

function count(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function responsePayloadHash(payloadJson: string): string {
  return `sha256:${createHash("sha256").update(payloadJson).digest("hex")}`;
}

function parseSubmitResult(payload: string | null): LeadMeSubmitResult {
  if (!payload) {
    throw new Error("Existing LeadMe submission cannot be replayed without response_payload_json");
  }
  try {
    return JSON.parse(payload) as LeadMeSubmitResult;
  } catch (err) {
    throw new Error(`Existing LeadMe submission has invalid response_payload_json: ${String(err)}`);
  }
}

async function recordLeadMeQueueEvent(
  db: Queryable,
  input: LeadMeQueueProgressInput & { eventType: "view" | "complete" },
): Promise<void> {
  await db.query(
    `INSERT INTO student_leadme_events
       (event_id, student_id, queue_entry_id, item_id, set_id, event_type, time_spent_sec)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.eventId ?? randomUUID(),
      input.studentId,
      input.queueEntryId,
      input.itemId ?? null,
      input.setId ?? null,
      input.eventType,
      input.timeSpentSec ?? null,
    ],
  );
}

export async function markLeadMeQueueViewed(
  db: Queryable,
  input: LeadMeQueueProgressInput,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE student_leadme_queue
        SET status = CASE WHEN status = 'served' THEN 'viewed' ELSE status END,
            viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1
        AND queue_entry_id = $2
        AND status IN ('served', 'viewed', 'started')`,
    [input.studentId, input.queueEntryId],
  );
  if ((result.rowCount ?? 0) === 0) return false;
  await recordLeadMeQueueEvent(db, { ...input, eventType: "view" });
  return true;
}

export async function markLeadMeQueueCompleted(
  db: Queryable,
  input: LeadMeQueueProgressInput,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE student_leadme_queue
        SET status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1
        AND queue_entry_id = $2
        AND status IN ('available', 'served', 'viewed', 'started')`,
    [input.studentId, input.queueEntryId],
  );
  if ((result.rowCount ?? 0) === 0) return false;
  await recordLeadMeQueueEvent(db, { ...input, eventType: "complete" });
  return true;
}

export async function readLeadMeSetSummary(
  db: Queryable,
  input: { studentId: string; setId: string },
): Promise<LeadMeSetSummary | null> {
  const { rows } = await db.query<LeadMeSetSummaryRow>(
    `SELECT s.set_id, s.title, s.set_type, s.status,
            COUNT(DISTINCT e.item_id) AS total_items,
            COUNT(DISTINCT CASE WHEN q.status = 'completed' THEN e.item_id END) AS completed_items,
            COUNT(DISTINCT CASE
              WHEN q.status IN ('available', 'served', 'viewed', 'started') THEN e.item_id
            END) AS active_items
       FROM leadme_sets s
       LEFT JOIN leadme_set_entries e ON e.set_id = s.set_id
       LEFT JOIN student_leadme_queue q
         ON q.set_id = s.set_id
        AND q.item_id = e.item_id
        AND q.student_id = $2
      WHERE s.set_id = $1
      GROUP BY s.set_id, s.title, s.set_type, s.status
      LIMIT 1`,
    [input.setId, input.studentId],
  );
  const row = rows[0];
  if (!row) return null;
  const total = count(row.total_items);
  const completed = count(row.completed_items);
  const active = count(row.active_items);
  return {
    set_id: row.set_id,
    title: row.title,
    set_type: row.set_type,
    status: row.status,
    total_items: total,
    completed_items: completed,
    active_items: active,
    pending_items: Math.max(0, total - completed),
  };
}

export async function enqueueLeadMeSet(
  db: Queryable,
  input: { studentId: string; setId: string; currentDay: number },
): Promise<EnqueueLeadMeSetResult | null> {
  const { rows } = await db.query<EnqueueLeadMeSetRow>(
    `SELECT s.set_id, s.title, s.set_type, s.status,
            COUNT(DISTINCT CASE WHEN i.item_id IS NOT NULL THEN e.item_id END) AS total_items
       FROM leadme_sets s
       LEFT JOIN leadme_set_entries e ON e.set_id = s.set_id
       LEFT JOIN leadme_items i
         ON i.item_id = e.item_id
        AND i.status IN ('active', 'published')
      WHERE s.set_id = $1
        AND s.status IN ('active', 'published')
      GROUP BY s.set_id, s.title, s.set_type, s.status
      LIMIT 1`,
    [input.setId],
  );
  const set = rows[0];
  if (!set) return null;

  const insert = await db.query(
    `INSERT IGNORE INTO student_leadme_queue
       (queue_entry_id, student_id, program_id, day_number, origin_day_number, rail_scope,
        set_id, item_id, item_version, content_hash, status, source, priority, mandatory,
        dependency_free, available_at, idempotency_key)
     SELECT CONCAT('lq_', SUBSTR(SHA2(CONCAT($1, '|', s.set_id, '|', e.item_id), 256), 1, 32)),
            $1, 'J7-GUIDED-PATH', $3, $3, 'current_day',
            s.set_id, i.item_id, i.version, i.content_hash, 'available', 'leadme_set',
            1000 - COALESCE(e.position, 0), COALESCE(e.required, 0),
            1, CURRENT_TIMESTAMP, CONCAT('set:', s.set_id, ':', e.item_id)
       FROM leadme_sets s
       JOIN leadme_set_entries e ON e.set_id = s.set_id
       JOIN leadme_items i
         ON i.item_id = e.item_id
        AND i.status IN ('active', 'published')
      WHERE s.set_id = $2
        AND s.status IN ('active', 'published')
      ORDER BY e.position ASC`,
    [input.studentId, input.setId, input.currentDay],
  );

  return {
    set_id: set.set_id,
    title: set.title,
    set_type: set.set_type,
    status: set.status,
    total_items: count(set.total_items),
    inserted_items: insert.rowCount ?? 0,
  };
}

export async function enqueueLeadMeSetForOutline(
  db: Queryable,
  input: { studentId: string; outlineCode: string; currentDay: number },
): Promise<EnqueueLeadMeSetResult | null> {
  const { rows } = await db.query<OutlineLeadMeSetRow>(
    `SELECT set_id
       FROM leadme_sets
      WHERE primary_outline_code = $1
        AND status IN ('active', 'published')
      ORDER BY CASE set_type
                 WHEN 'guided_repair' THEN 0
                 WHEN 'repair' THEN 1
                 WHEN 'practice' THEN 2
                 ELSE 3
               END,
               updated_at DESC,
               set_id ASC
      LIMIT 1`,
    [input.outlineCode],
  );
  const setId = rows[0]?.set_id;
  if (!setId) return null;
  return enqueueLeadMeSet(db, {
    studentId: input.studentId,
    setId,
    currentDay: input.currentDay,
  });
}

export async function recordLeadMeServedSnapshot(
  db: Queryable,
  served: ServedLeadMeSnapshot,
): Promise<boolean> {
  const studentId = served.snapshot.student_id;
  if (!studentId) {
    throw new Error("LeadMe served snapshots require a student_id before DB persistence");
  }

  const serverEvaluationRef =
    served.snapshot.server_evaluation_ref ??
    `${served.snapshot.item_id}:${served.snapshot.item_version}:${served.snapshot.compiled_server_payload_hash}`;

  const result = await db.query(
    `INSERT IGNORE INTO leadme_served_snapshots
       (served_snapshot_id, queue_entry_id, student_id, item_id, item_version,
        content_hash, compiled_front_payload_hash, compiled_server_payload_hash,
        answer_order_hash, server_evaluation_ref, served_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      served.snapshot.served_snapshot_id,
      served.snapshot.queue_entry_id,
      studentId,
      served.snapshot.item_id,
      served.snapshot.item_version,
      served.snapshot.content_hash,
      served.snapshot.compiled_front_payload_hash,
      served.snapshot.compiled_server_payload_hash,
      served.snapshot.answer_order_hash,
      serverEvaluationRef,
      mysqlDateTime(served.snapshot.served_at),
      mysqlDateTime(served.snapshot.expires_at),
    ],
  );
  return result.rowCount === 1;
}

export async function readLeadMeSubmissionByIdempotency(
  db: Queryable,
  input: ReadLeadMeSubmissionInput,
): Promise<LeadMeSubmissionRecord | null> {
  const { rows } = await db.query<LeadMeSubmissionRow>(
    `SELECT student_id, queue_entry_id, idempotency_key, attempt_event_id, response_payload_json
       FROM leadme_submissions
      WHERE student_id = $1
        AND queue_entry_id = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [input.studentId, input.queueEntryId, input.idempotencyKey],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    student_id: row.student_id,
    queue_entry_id: row.queue_entry_id,
    idempotency_key: row.idempotency_key,
    attempt_event_id: row.attempt_event_id,
    result: parseSubmitResult(row.response_payload_json),
  };
}

export async function recordLeadMeSubmission(
  db: Queryable,
  input: RecordLeadMeSubmissionInput,
): Promise<RecordLeadMeSubmissionResult> {
  if (input.result.student_id !== null && input.result.student_id !== input.studentId) {
    throw new Error(
      `LeadMe submission student mismatch: expected ${input.result.student_id}, got ${input.studentId}`,
    );
  }

  const submissionId = input.submissionId ?? randomUUID();
  const payloadJson = JSON.stringify(input.result);
  const insert = await db.query(
    `INSERT IGNORE INTO leadme_submissions
       (submission_id, student_id, queue_entry_id, served_snapshot_id, item_id,
        item_version, selected_response, correctness, branch_id, attempt_event_id,
        idempotency_key, response_payload_json, response_payload_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      submissionId,
      input.studentId,
      input.result.queue_entry_id,
      input.result.served_snapshot_id,
      input.result.item_id,
      input.result.item_version,
      input.result.selected_response,
      input.result.correctness,
      input.result.branch_id,
      input.attemptEventId,
      input.idempotencyKey,
      payloadJson,
      responsePayloadHash(payloadJson),
    ],
  );

  if (insert.rowCount === 1) {
    return {
      inserted: true,
      submission_id: submissionId,
      attempt_event_id: input.attemptEventId,
      result: input.result,
    };
  }

  const existing = await readLeadMeSubmissionByIdempotency(db, {
    studentId: input.studentId,
    queueEntryId: input.result.queue_entry_id,
    idempotencyKey: input.idempotencyKey,
  });
  if (!existing) {
    throw new Error("LeadMe idempotent submission insert was ignored but no existing row was found");
  }

  return {
    inserted: false,
    submission_id: null,
    attempt_event_id: existing.attempt_event_id ?? null,
    result: existing.result,
  };
}
