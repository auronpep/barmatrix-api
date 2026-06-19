import { createHash } from "node:crypto";
import type { DbPool } from "../db.js";
import {
  chooseLeadMeQueueEntry,
  type LeadMeQueueEntry,
  type QueueSelection,
} from "./leadme-queue.js";
import { recordLeadMeServedSnapshot } from "./leadme-runtime-store.js";
import type {
  BranchPrivatePayload,
  JsonValue,
  ServedLeadMeSnapshot,
  SubmitPrivatePayload,
} from "./leadme-submit.js";

type Queryable = Pick<DbPool, "query">;

interface LeadMeQueueRow {
  queue_entry_id: string;
  student_id: string;
  item_id: string;
  item_version: string;
  content_hash: string;
  status: LeadMeQueueEntry["status"];
  rail_scope: LeadMeQueueEntry["rail_scope"];
  day_number: number | string | null;
  origin_day_number: number | string | null;
  priority: number | string | null;
  mandatory: number | boolean | null;
  dependency_free: number | boolean | null;
  available_at: string | Date | null;
  served_at: string | Date | null;
  viewed_at: string | Date | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  stalled_at: string | Date | null;
  stall_eligible_at: string | Date | null;
  injection_depth: number | string | null;
}

interface LeadMeItemRow {
  item_id: string;
  version: string;
  item_type: string;
  subject: string | null;
  primary_outline_code: string | null;
  content_hash: string | null;
  compiled_json_text: string;
}

interface LeadMeCompiledPayloadRow {
  submit_private_json: string;
  branch_private_json: string;
  compiled_server_payload_hash: string;
}

export interface ReadLeadMeCurrentInput {
  studentId: string;
  currentDay: number;
  now: Date;
  allowCatchup?: boolean;
  allowSpacedReview?: boolean;
}

export interface LeadMeCurrentTask {
  queue_entry_id: string;
  selection_reason: QueueSelection["reason"];
  item: Record<string, unknown>;
}

export interface LeadMeCurrentResponse {
  current_day: number;
  current_task: LeadMeCurrentTask | null;
  selection_reason: QueueSelection["reason"];
}

function bool(value: number | boolean | null): boolean {
  return value === true || value === 1;
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function queueRowToEntry(row: LeadMeQueueRow): LeadMeQueueEntry {
  return {
    queue_entry_id: row.queue_entry_id,
    student_id: row.student_id,
    item_id: row.item_id,
    item_version: row.item_version,
    content_hash: row.content_hash,
    status: row.status,
    rail_scope: row.rail_scope,
    day_number: numberOrNull(row.day_number),
    origin_day_number: numberOrNull(row.origin_day_number),
    priority: numberOrNull(row.priority) ?? 0,
    mandatory: bool(row.mandatory),
    dependency_free: row.dependency_free === null ? true : bool(row.dependency_free),
    available_at: row.available_at,
    served_at: row.served_at,
    viewed_at: row.viewed_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    stalled_at: row.stalled_at,
    stall_eligible_at: row.stall_eligible_at,
    injection_depth: numberOrNull(row.injection_depth),
  };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function hashObj(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function snapshotId(queueEntryId: string, contentHash: string): string {
  return `snap_${createHash("sha256").update(`${queueEntryId}|${contentHash}`).digest("hex").slice(0, 16)}`;
}

function parseObject(text: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function optionIds(frontPayload: Record<string, unknown>): string[] {
  const interaction = frontPayload.interaction;
  if (!interaction || typeof interaction !== "object" || Array.isArray(interaction)) return [];
  const options = (interaction as Record<string, unknown>).options;
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) return null;
      const id = (option as Record<string, unknown>).id;
      return typeof id === "string" ? id : null;
    })
    .filter((id): id is string => id !== null);
}

async function readQueueEntries(db: Queryable, studentId: string): Promise<LeadMeQueueEntry[]> {
  const { rows } = await db.query<LeadMeQueueRow>(
    `SELECT queue_entry_id, student_id, item_id, item_version, content_hash, status, rail_scope,
            day_number, origin_day_number, priority, mandatory, dependency_free,
            available_at, served_at, viewed_at, started_at, completed_at,
            stalled_at, stall_eligible_at, injection_depth
       FROM student_leadme_queue
      WHERE student_id = $1
        AND status IN ('available', 'served', 'viewed', 'started')
      ORDER BY priority DESC, available_at ASC, queue_entry_id ASC`,
    [studentId],
  );
  return rows.map(queueRowToEntry);
}

async function readLeadMeItem(
  db: Queryable,
  entry: LeadMeQueueEntry,
): Promise<LeadMeItemRow> {
  const { rows } = await db.query<LeadMeItemRow>(
    `SELECT item_id, version, item_type, subject, primary_outline_code, content_hash, compiled_json_text
       FROM leadme_items
      WHERE item_id = $1 AND version = $2 AND content_hash = $3
      LIMIT 1`,
    [entry.item_id, entry.item_version, entry.content_hash],
  );
  const row = rows[0];
  if (!row) throw new Error(`LeadMe item not found: ${entry.item_id}@${entry.item_version}`);
  if (!row.content_hash) throw new Error(`LeadMe item missing content_hash: ${entry.item_id}`);
  return row;
}

async function readCompiledPayload(
  db: Queryable,
  item: LeadMeItemRow,
): Promise<LeadMeCompiledPayloadRow> {
  const { rows } = await db.query<LeadMeCompiledPayloadRow>(
    `SELECT submit_private_json, branch_private_json, compiled_server_payload_hash
       FROM leadme_compiled_payloads
      WHERE item_id = $1
        AND item_version = $2
        AND content_hash = $3
      LIMIT 1`,
    [item.item_id, item.version, item.content_hash],
  );
  const row = rows[0];
  if (!row) throw new Error(`LeadMe server payload not found: ${item.item_id}@${item.version}`);
  return row;
}

async function markQueueEntryServed(
  db: Queryable,
  input: { studentId: string; queueEntryId: string },
): Promise<void> {
  await db.query(
    `UPDATE student_leadme_queue
        SET status = 'served',
            served_at = COALESCE(served_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1
        AND queue_entry_id = $2
        AND status = 'available'`,
    [input.studentId, input.queueEntryId],
  );
}

function buildServedSnapshot(input: {
  studentId: string;
  entry: LeadMeQueueEntry;
  item: LeadMeItemRow;
  frontPayload: Record<string, unknown>;
  compiledPayload: LeadMeCompiledPayloadRow;
  now: Date;
}): ServedLeadMeSnapshot {
  const contentHash = input.item.content_hash;
  if (!contentHash) throw new Error(`LeadMe item missing content_hash: ${input.item.item_id}`);
  return {
    schema_version: "served_snapshot.v1",
    snapshot: {
      served_snapshot_id: snapshotId(input.entry.queue_entry_id, contentHash),
      queue_entry_id: input.entry.queue_entry_id,
      student_id: input.studentId,
      item_id: input.item.item_id,
      item_version: input.item.version,
      content_hash: contentHash,
      compiled_front_payload_hash: hashObj(input.frontPayload),
      compiled_server_payload_hash: input.compiledPayload.compiled_server_payload_hash,
      answer_order_hash: hashObj(optionIds(input.frontPayload)),
      served_at: input.now.toISOString().replace(".000Z", "Z"),
      expires_at: null,
      server_evaluation_ref: `leadme_compiled_payloads:${input.item.item_id}:${input.item.version}:${contentHash}`,
      immutable: true,
    },
    submit_private: parseObject(
      input.compiledPayload.submit_private_json,
      "submit_private_json",
    ) as unknown as SubmitPrivatePayload,
    branch_private: parseObject(
      input.compiledPayload.branch_private_json,
      "branch_private_json",
    ) as unknown as BranchPrivatePayload,
  };
}

export async function readLeadMeCurrent(
  db: Queryable,
  input: ReadLeadMeCurrentInput,
): Promise<LeadMeCurrentResponse> {
  const entries = await readQueueEntries(db, input.studentId);
  const selection = chooseLeadMeQueueEntry(entries, {
    now: input.now,
    currentDay: input.currentDay,
    allowCatchup: input.allowCatchup,
    allowSpacedReview: input.allowSpacedReview,
  });
  if (!selection.entry) {
    return {
      current_day: input.currentDay,
      current_task: null,
      selection_reason: selection.reason,
    };
  }

  const item = await readLeadMeItem(db, selection.entry);
  const compiledPayload = await readCompiledPayload(db, item);
  const baseFrontPayload = parseObject(item.compiled_json_text, "compiled_json_text");
  const frontPayload: Record<string, JsonValue | unknown> = {
    ...baseFrontPayload,
    queue_entry_id: selection.entry.queue_entry_id,
    item_id: item.item_id,
    item_version: item.version,
    item_type: item.item_type,
    subject: item.subject,
    primary_outline_code: item.primary_outline_code,
  };
  const served = buildServedSnapshot({
    studentId: input.studentId,
    entry: selection.entry,
    item,
    frontPayload,
    compiledPayload,
    now: input.now,
  });
  await recordLeadMeServedSnapshot(db, served);
  await markQueueEntryServed(db, {
    studentId: input.studentId,
    queueEntryId: selection.entry.queue_entry_id,
  });

  return {
    current_day: input.currentDay,
    current_task: {
      queue_entry_id: selection.entry.queue_entry_id,
      selection_reason: selection.reason,
      item: frontPayload,
    },
    selection_reason: selection.reason,
  };
}
