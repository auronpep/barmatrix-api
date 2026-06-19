import type { DbPool } from "../db.js";
import type { JsonObject, JsonValue, LeadMeSubmitResult } from "./leadme-submit.js";

type Queryable = Pick<DbPool, "query">;

export interface LeadMeAttemptAdapterInput {
  eventId: string;
  studentId: string;
  occurredAt: string;
  requestId?: string;
  result: LeadMeSubmitResult;
  itemType: string;
  sourceQuestionId: string | null;
  selectedChoiceId?: string | null;
  correctResponse?: string | readonly string[] | null;
  primaryOutlineCode: string;
  subject: string;
  secondaryOutlineCodes?: readonly string[];
  setId?: string | null;
  programId?: string | null;
  timeSpentSec?: number | null;
  activeTimeSec?: number | null;
  firstChoiceAtSec?: number | null;
  finalChoiceChanged?: boolean | null;
  confidenceInitial?: number | null;
  confidenceFinal?: number | null;
  flagged?: boolean | null;
  skipped?: boolean | null;
}

export interface StudentAttemptEventV2 {
  schema_version: "student_attempt_event.v2";
  event: {
    event_id: string;
    student_id: string;
    occurred_at: string;
    request_id?: string;
  };
  context: {
    source_surface: "leadme";
    program_id?: string;
    set_id?: string;
    queue_entry_id: string;
    item_id: string;
    qid?: string;
  };
  interaction: {
    type: string;
    selected_response: string | readonly string[] | null;
    correct_response: string | readonly string[] | null;
    correctness: "correct" | "incorrect" | "partial" | "unscored";
    time_spent_sec: number | null;
    confidence: number | null;
  };
  atlas: {
    primary_outline_code: string;
    subject: string;
    secondary_outline_codes: readonly string[];
  };
  scoring_signals: JsonObject;
  forensics: JsonObject;
}

export interface LeadMeStudentAttemptRow {
  attempt_id: string;
  student_id: string;
  question_id: string;
  selected_choice_id: string | null;
  selected_letter: string | null;
  correct: 0 | 1;
  confidence: number | null;
  flagged: 0 | 1;
  time_seconds: number | null;
  platform: "leadme";
  set_id: string | null;
  served_snapshot_id: string;
  metadata: JsonObject;
}

export interface LeadMeAttemptTelemetryRow {
  attempt_event_id: string;
  student_id: string;
  source_surface: "leadme";
  queue_entry_id: string;
  item_id: string;
  set_id: string | null;
  time_spent_sec: number | null;
  active_time_sec: number | null;
  first_choice_at_sec: number | null;
  final_choice_changed: 0 | 1;
  confidence_initial: number | null;
  confidence_final: number | null;
  confidence_adjusted: 0 | 1;
  confidence_bucket: "low" | "medium" | "high" | null;
  flagged: 0 | 1;
  skipped: 0 | 1;
}

function maybeObject(value: JsonValue | null): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function bit(value: boolean | null | undefined): 0 | 1 {
  return value === true ? 1 : 0;
}

function legacySelectedLetter(value: string): string | null {
  return /^[A-D]$/.test(value) ? value : null;
}

function legacyConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return Math.max(1, Math.min(5, Math.ceil(clamped / 20)));
}

function confidenceBucket(value: number | null | undefined): LeadMeAttemptTelemetryRow["confidence_bucket"] {
  if (value === null || value === undefined) return null;
  if (value >= 70) return "high";
  if (value <= 40) return "low";
  return "medium";
}

function confidenceAdjusted(input: LeadMeAttemptAdapterInput): 0 | 1 {
  if (input.confidenceInitial === null || input.confidenceInitial === undefined) return 0;
  if (input.confidenceFinal === null || input.confidenceFinal === undefined) return 0;
  return input.confidenceInitial === input.confidenceFinal ? 0 : 1;
}

export function buildLeadMeAttemptEvent(
  input: LeadMeAttemptAdapterInput,
): StudentAttemptEventV2 {
  return {
    schema_version: "student_attempt_event.v2",
    event: {
      event_id: input.eventId,
      student_id: input.studentId,
      occurred_at: input.occurredAt,
      ...(input.requestId ? { request_id: input.requestId } : {}),
    },
    context: {
      source_surface: "leadme",
      ...(input.programId ? { program_id: input.programId } : {}),
      ...(input.setId ? { set_id: input.setId } : {}),
      queue_entry_id: input.result.queue_entry_id,
      item_id: input.result.item_id,
      ...(input.sourceQuestionId ? { qid: input.sourceQuestionId } : {}),
    },
    interaction: {
      type: input.itemType,
      selected_response: input.result.selected_response,
      correct_response: input.correctResponse ?? null,
      correctness: input.result.correctness,
      time_spent_sec: input.timeSpentSec ?? null,
      confidence: input.confidenceFinal ?? null,
    },
    atlas: {
      primary_outline_code: input.primaryOutlineCode,
      subject: input.subject,
      secondary_outline_codes: input.secondaryOutlineCodes ?? [],
    },
    scoring_signals: maybeObject(input.result.scoring_signals),
    forensics: {
      branch_id: input.result.branch_id,
      served_snapshot_id: input.result.served_snapshot_id,
    },
  };
}

export function buildLeadMeStudentAttemptRow(
  input: LeadMeAttemptAdapterInput,
): LeadMeStudentAttemptRow | null {
  if (input.itemType !== "drill_question" || !input.sourceQuestionId) return null;

  return {
    attempt_id: input.eventId,
    student_id: input.studentId,
    question_id: input.sourceQuestionId,
    selected_choice_id: input.selectedChoiceId ?? null,
    selected_letter: legacySelectedLetter(input.result.selected_response),
    correct: input.result.correctness === "correct" ? 1 : 0,
    confidence: legacyConfidence(input.confidenceFinal),
    flagged: bit(input.flagged),
    time_seconds: input.timeSpentSec ?? null,
    platform: "leadme",
    set_id: input.setId ?? null,
    served_snapshot_id: input.result.served_snapshot_id,
    metadata: {
      schema_version: "student_attempt_event.v2",
      source_surface: "leadme",
      queue_entry_id: input.result.queue_entry_id,
      item_id: input.result.item_id,
      item_version: input.result.item_version,
      branch_id: input.result.branch_id,
      selected_response: input.result.selected_response,
      scoring_signals: maybeObject(input.result.scoring_signals),
    },
  };
}

export function buildLeadMeAttemptTelemetryRow(
  input: LeadMeAttemptAdapterInput,
): LeadMeAttemptTelemetryRow {
  return {
    attempt_event_id: input.eventId,
    student_id: input.studentId,
    source_surface: "leadme",
    queue_entry_id: input.result.queue_entry_id,
    item_id: input.result.item_id,
    set_id: input.setId ?? null,
    time_spent_sec: input.timeSpentSec ?? null,
    active_time_sec: input.activeTimeSec ?? null,
    first_choice_at_sec: input.firstChoiceAtSec ?? null,
    final_choice_changed: bit(input.finalChoiceChanged),
    confidence_initial: input.confidenceInitial ?? null,
    confidence_final: input.confidenceFinal ?? null,
    confidence_adjusted: confidenceAdjusted(input),
    confidence_bucket: confidenceBucket(input.confidenceFinal),
    flagged: bit(input.flagged),
    skipped: bit(input.skipped),
  };
}

export async function insertLeadMeStudentAttempt(
  db: Queryable,
  row: LeadMeStudentAttemptRow,
): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
        correct, confidence, flagged, time_seconds, platform, set_id, served_snapshot_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      row.attempt_id,
      row.student_id,
      row.question_id,
      row.selected_choice_id,
      row.selected_letter,
      row.correct,
      row.confidence,
      row.flagged,
      row.time_seconds,
      row.platform,
      row.set_id,
      row.served_snapshot_id,
      JSON.stringify(row.metadata),
    ],
  );
  return result.rowCount === 1;
}

export async function insertLeadMeAttemptTelemetry(
  db: Queryable,
  row: LeadMeAttemptTelemetryRow,
): Promise<boolean> {
  const result = await db.query(
    `INSERT IGNORE INTO attempt_telemetry_ext
       (attempt_event_id, student_id, source_surface, queue_entry_id, item_id,
        set_id, time_spent_sec, active_time_sec, first_choice_at_sec,
        final_choice_changed, confidence_initial, confidence_final,
        confidence_adjusted, confidence_bucket, flagged, skipped)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      row.attempt_event_id,
      row.student_id,
      row.source_surface,
      row.queue_entry_id,
      row.item_id,
      row.set_id,
      row.time_spent_sec,
      row.active_time_sec,
      row.first_choice_at_sec,
      row.final_choice_changed,
      row.confidence_initial,
      row.confidence_final,
      row.confidence_adjusted,
      row.confidence_bucket,
      row.flagged,
      row.skipped,
    ],
  );
  return result.rowCount === 1;
}
