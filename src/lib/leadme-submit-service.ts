import { randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";
import {
  buildLeadMeAttemptTelemetryRow,
  buildLeadMeStudentAttemptRow,
  insertLeadMeAttemptTelemetry,
  insertLeadMeStudentAttempt,
} from "./leadme-attempt-adapter.js";
import {
  readLeadMeDebriefIntelligence,
  type LeadMeDebriefIntelligence,
} from "./leadme-debrief-service.js";
import {
  readLeadMeSubmissionByIdempotency,
  recordLeadMeSubmission,
} from "./leadme-runtime-store.js";
import {
  evaluateLeadMeSubmit,
  type BranchPrivatePayload,
  type LeadMeSubmitResult,
  type ServedLeadMeSnapshot,
  type SubmitPrivatePayload,
} from "./leadme-submit.js";
import {
  applyLeadMeScoringProjection,
  projectLeadMeScoring,
} from "./leadme-scoring.js";

type Queryable = Pick<DbPool, "query">;

interface ServedSnapshotForSubmitRow {
  served_snapshot_id: string;
  queue_entry_id: string;
  student_id: string;
  item_id: string;
  item_version: string;
  content_hash: string;
  compiled_front_payload_hash: string;
  compiled_server_payload_hash: string;
  answer_order_hash: string | null;
  served_at: string;
  expires_at: string | null;
  server_evaluation_ref: string;
  submit_private_json: string;
  branch_private_json: string;
  item_type: string;
  subject: string | null;
  primary_outline_code: string | null;
  external_id: string | null;
  set_id: string | null;
  day_number: number | string | null;
  origin_day_number: number | string | null;
  injection_depth: number | string | null;
}

export interface SubmitLeadMeItemInput {
  studentId: string;
  queueEntryId: string;
  selectedResponse: string;
  idempotencyKey: string;
  confidence?: number | null;
  timeSpentSec?: number | null;
  now: Date;
  eventIdFactory?: () => string;
  submissionIdFactory?: () => string;
  repairQueueEntryIdFactory?: () => string;
}

export interface SubmitLeadMeItemResponse {
  idempotent_replay: boolean;
  attempt_event_id: string | null;
  debrief_focus: LeadMeDebriefIntelligence | null;
  scoring_summary: { signals_recorded: boolean };
  result: LeadMeSubmitResult;
}

function parsePayload<T>(value: string, label: string): T {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as T;
}

async function readServedSnapshotForSubmit(
  db: Queryable,
  input: { studentId: string; queueEntryId: string },
): Promise<{ served: ServedLeadMeSnapshot; row: ServedSnapshotForSubmitRow }> {
  const { rows } = await db.query<ServedSnapshotForSubmitRow>(
    `SELECT s.served_snapshot_id, s.queue_entry_id, s.student_id, s.item_id,
            s.item_version, s.content_hash, s.compiled_front_payload_hash,
            s.compiled_server_payload_hash, s.answer_order_hash,
            DATE_FORMAT(s.served_at, '%Y-%m-%dT%H:%i:%sZ') AS served_at,
            DATE_FORMAT(s.expires_at, '%Y-%m-%dT%H:%i:%sZ') AS expires_at,
            s.server_evaluation_ref,
            p.submit_private_json, p.branch_private_json,
            i.item_type, i.subject, i.primary_outline_code, i.external_id,
            q.set_id, q.day_number, q.origin_day_number, q.injection_depth
       FROM leadme_served_snapshots s
       JOIN leadme_compiled_payloads p
         ON p.item_id = s.item_id
        AND p.item_version = s.item_version
        AND p.content_hash = s.content_hash
       JOIN leadme_items i
         ON i.item_id = s.item_id
        AND i.version = s.item_version
       LEFT JOIN student_leadme_queue q
         ON q.queue_entry_id = s.queue_entry_id
        AND q.student_id = s.student_id
      WHERE s.student_id = $1
        AND s.queue_entry_id = $2
      ORDER BY s.served_at DESC
      LIMIT 1`,
    [input.studentId, input.queueEntryId],
  );
  const row = rows[0];
  if (!row) throw new Error(`LeadMe served snapshot not found for ${input.queueEntryId}`);
  if (!row.answer_order_hash) {
    throw new Error(`LeadMe served snapshot missing answer_order_hash for ${input.queueEntryId}`);
  }
  return {
    row,
    served: {
      schema_version: "served_snapshot.v1",
      snapshot: {
        served_snapshot_id: row.served_snapshot_id,
        queue_entry_id: row.queue_entry_id,
        student_id: row.student_id,
        item_id: row.item_id,
        item_version: row.item_version,
        content_hash: row.content_hash,
        compiled_front_payload_hash: row.compiled_front_payload_hash,
        compiled_server_payload_hash: row.compiled_server_payload_hash,
        answer_order_hash: row.answer_order_hash,
        served_at: row.served_at,
        expires_at: row.expires_at,
        server_evaluation_ref: row.server_evaluation_ref,
        immutable: true,
      },
      submit_private: parsePayload<SubmitPrivatePayload>(
        row.submit_private_json,
        "submit_private_json",
      ),
      branch_private: parsePayload<BranchPrivatePayload>(
        row.branch_private_json,
        "branch_private_json",
      ),
    },
  };
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function markQueueEntryCompleted(
  db: Queryable,
  input: { studentId: string; queueEntryId: string },
): Promise<void> {
  await db.query(
    `UPDATE student_leadme_queue
        SET status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1
        AND queue_entry_id = $2
        AND status IN ('served', 'viewed', 'started', 'available')`,
    [input.studentId, input.queueEntryId],
  );
}

async function enqueueImmediateRepair(
  db: Queryable,
  input: {
    studentId: string;
    parent: ServedSnapshotForSubmitRow;
    result: LeadMeSubmitResult;
    queueEntryId: string;
  },
): Promise<void> {
  const proposal = input.result.immediate_queue_proposal;
  if (!proposal) return;
  const dayNumber = numberOrNull(input.parent.day_number);
  const originDayNumber = numberOrNull(input.parent.origin_day_number) ?? dayNumber;
  const parentDepth = numberOrNull(input.parent.injection_depth) ?? 0;
  await db.query(
    `INSERT IGNORE INTO student_leadme_queue
       (queue_entry_id, student_id, day_number, origin_day_number, rail_scope,
        set_id, item_id, item_version, content_hash, status, source, priority, mandatory,
        dependency_free, available_at, injection_parent_entry_id,
        injection_depth, injection_reason)
     SELECT $1, $2, $3, $4, 'in_set_immediate',
            $5, i.item_id, i.version, i.content_hash, 'available',
            'leadme_branch', 100, $8, $9, CURRENT_TIMESTAMP, $10, $11, $12
       FROM leadme_items i
      WHERE i.item_id = $6
        AND i.version = $7
        AND i.status IN ('active', 'published')
      LIMIT 1`,
    [
      input.queueEntryId,
      input.studentId,
      dayNumber,
      originDayNumber,
      input.parent.set_id,
      proposal.item_id,
      proposal.item_version,
      proposal.mandatory ? 1 : 0,
      proposal.dependency_free ? 1 : 0,
      input.parent.queue_entry_id,
      parentDepth + 1,
      proposal.origin_branch_id,
    ],
  );
}

export async function submitLeadMeItem(
  db: Queryable,
  input: SubmitLeadMeItemInput,
): Promise<SubmitLeadMeItemResponse> {
  const existing = await readLeadMeSubmissionByIdempotency(db, {
    studentId: input.studentId,
    queueEntryId: input.queueEntryId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) {
    return {
      idempotent_replay: true,
      attempt_event_id: existing.attempt_event_id ?? null,
      debrief_focus: null,
      scoring_summary: { signals_recorded: false },
      result: existing.result,
    };
  }

  const { served, row } = await readServedSnapshotForSubmit(db, {
    studentId: input.studentId,
    queueEntryId: input.queueEntryId,
  });
  const result = evaluateLeadMeSubmit(served, {
    queue_entry_id: input.queueEntryId,
    selected_response: input.selectedResponse,
    idempotency_key: input.idempotencyKey,
  });
  const debriefFocus = await readLeadMeDebriefIntelligence(db, {
    subject: row.subject ?? "UNKNOWN",
    primaryOutlineCode: row.primary_outline_code ?? "00000000",
    selectedResponse: result.selected_response,
    correctResponse: served.submit_private.correct,
  });

  const attemptEventId = input.eventIdFactory?.() ?? randomUUID();
  const saved = await recordLeadMeSubmission(db, {
    submissionId: input.submissionIdFactory?.() ?? randomUUID(),
    studentId: input.studentId,
    idempotencyKey: input.idempotencyKey,
    attemptEventId,
    result,
  });

  if (saved.inserted) {
    const adapterInput = {
      eventId: attemptEventId,
      studentId: input.studentId,
      occurredAt: input.now.toISOString().replace(".000Z", "Z"),
      result,
      itemType: row.item_type,
      sourceQuestionId: row.external_id,
      selectedChoiceId: null,
      correctResponse: served.submit_private.correct,
      primaryOutlineCode: row.primary_outline_code ?? "00000000",
      subject: row.subject ?? "UNKNOWN",
      setId: row.set_id,
      timeSpentSec: input.timeSpentSec ?? null,
      confidenceFinal: input.confidence ?? null,
    };
    const attemptRow = buildLeadMeStudentAttemptRow(adapterInput);
    if (attemptRow) {
      await insertLeadMeStudentAttempt(db, attemptRow);
      await insertLeadMeAttemptTelemetry(db, buildLeadMeAttemptTelemetryRow(adapterInput));
    }
    await applyLeadMeScoringProjection(
      db,
      projectLeadMeScoring({
        result,
        studentId: input.studentId,
        attemptEventId,
        subject: row.subject ?? "UNKNOWN",
        primaryOutlineCode: row.primary_outline_code ?? "00000000",
        confidence: input.confidence ?? null,
      }),
    );
    await enqueueImmediateRepair(db, {
      studentId: input.studentId,
      parent: row,
      result,
      queueEntryId: input.repairQueueEntryIdFactory?.() ?? randomUUID(),
    });
    await markQueueEntryCompleted(db, {
      studentId: input.studentId,
      queueEntryId: input.queueEntryId,
    });
  }

  return {
    idempotent_replay: !saved.inserted,
    attempt_event_id: saved.attempt_event_id,
    debrief_focus: debriefFocus,
    scoring_summary: { signals_recorded: saved.inserted },
    result: saved.result,
  };
}
