export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type LeadMeCorrectness = "correct" | "incorrect";

export interface ServedSnapshotMetadata {
  served_snapshot_id: string;
  queue_entry_id: string;
  student_id: string | null;
  item_id: string;
  item_version: string;
  content_hash: string;
  compiled_front_payload_hash: string;
  compiled_server_payload_hash: string;
  answer_order_hash: string;
  served_at: string;
  expires_at: string | null;
  server_evaluation_ref: string | null;
  immutable: true;
}

export interface SubmitResponsePayload {
  branch_id: string;
  student_label?: string;
  scoring_signals?: JsonValue;
}

export interface SubmitPrivatePayload {
  item_id: string;
  item_version: string;
  content_hash: string;
  correct: readonly string[];
  responses: Record<string, SubmitResponsePayload>;
}

export interface BranchAction {
  type: string;
  item_id?: string;
  item_version?: string;
  label?: string;
  mandatory?: boolean;
  dependency_free?: boolean;
  [key: string]: JsonValue | undefined;
}

export interface BranchPayload {
  display_blocks?: readonly JsonValue[];
  actions?: readonly BranchAction[];
}

export interface BranchPrivatePayload {
  item_id: string;
  item_version: string;
  content_hash: string;
  branches: Record<string, BranchPayload>;
}

export interface ServedLeadMeSnapshot {
  schema_version: "served_snapshot.v1";
  snapshot: ServedSnapshotMetadata;
  submit_private: SubmitPrivatePayload;
  branch_private: BranchPrivatePayload;
}

export interface LeadMeSubmitRequest {
  queue_entry_id: string;
  selected_response: string;
  idempotency_key: string;
}

export interface LeadMeImmediateQueueProposal {
  type: "enqueue_immediate";
  item_id: string;
  item_version: string;
  label: string;
  mandatory: boolean;
  dependency_free: boolean;
  origin_branch_id: string;
  origin_queue_entry_id: string;
}

export interface LeadMeNextActionSummary {
  type: "queued" | "continue" | "none";
  label: string | null;
}

export interface LeadMeAttemptEvent {
  served_snapshot_id: string;
  queue_entry_id: string;
  item_id: string;
  item_version: string;
  selected_response: string;
  correctness: LeadMeCorrectness;
  branch_id: string;
  scoring_signals: JsonValue | null;
}

export interface LeadMeSubmitResult {
  served_snapshot_id: string;
  queue_entry_id: string;
  student_id: string | null;
  item_id: string;
  item_version: string;
  selected_response: string;
  correctness: LeadMeCorrectness;
  branch_id: string;
  back_blocks: readonly JsonValue[];
  scoring_signals: JsonValue | null;
  immediate_queue_proposal: LeadMeImmediateQueueProposal | null;
  next_action_summary: LeadMeNextActionSummary;
  attempt_event: LeadMeAttemptEvent;
}

export interface LeadMeSubmissionRecord {
  student_id: string | null;
  queue_entry_id: string;
  idempotency_key: string;
  attempt_event_id?: string | null;
  result: LeadMeSubmitResult;
}

function selectedResponse(request: LeadMeSubmitRequest): string {
  return request.selected_response.trim();
}

function immediateQueueProposal(
  branch: BranchPayload,
  branchId: string,
  queueEntryId: string,
): LeadMeImmediateQueueProposal | null {
  const action = branch.actions?.find(
    (candidate) => candidate.type === "enqueue_immediate" && typeof candidate.item_id === "string",
  );
  if (!action || typeof action.item_id !== "string") return null;

  return {
    type: "enqueue_immediate",
    item_id: action.item_id,
    item_version: typeof action.item_version === "string" ? action.item_version : "1.0.0",
    label: typeof action.label === "string" ? action.label : "Repair card added",
    mandatory: action.mandatory === true,
    dependency_free: action.dependency_free !== false,
    origin_branch_id: branchId,
    origin_queue_entry_id: queueEntryId,
  };
}

function nextActionSummary(
  proposal: LeadMeImmediateQueueProposal | null,
  branch: BranchPayload,
): LeadMeNextActionSummary {
  if (proposal) return { type: "queued", label: proposal.label };
  if (branch.actions?.some((action) => action.type === "continue_set")) {
    return { type: "continue", label: "Continue" };
  }
  return { type: "none", label: null };
}

export function evaluateLeadMeSubmit(
  served: ServedLeadMeSnapshot,
  request: LeadMeSubmitRequest,
): LeadMeSubmitResult {
  if (request.queue_entry_id !== served.snapshot.queue_entry_id) {
    throw new Error(
      `LeadMe submit queue entry mismatch: expected ${served.snapshot.queue_entry_id}, got ${request.queue_entry_id}`,
    );
  }

  const selected = selectedResponse(request);
  const response = served.submit_private.responses[selected];
  if (!response) {
    throw new Error(`Unknown LeadMe response ${selected} for ${served.snapshot.item_id}`);
  }

  const branch = served.branch_private.branches[response.branch_id];
  if (!branch) {
    throw new Error(`Missing LeadMe branch ${response.branch_id} for ${served.snapshot.item_id}`);
  }

  const correctness: LeadMeCorrectness = served.submit_private.correct.includes(selected)
    ? "correct"
    : "incorrect";
  const scoringSignals = response.scoring_signals ?? null;
  const proposal = immediateQueueProposal(
    branch,
    response.branch_id,
    served.snapshot.queue_entry_id,
  );
  const attemptEvent: LeadMeAttemptEvent = {
    served_snapshot_id: served.snapshot.served_snapshot_id,
    queue_entry_id: served.snapshot.queue_entry_id,
    item_id: served.snapshot.item_id,
    item_version: served.snapshot.item_version,
    selected_response: selected,
    correctness,
    branch_id: response.branch_id,
    scoring_signals: scoringSignals,
  };

  return {
    served_snapshot_id: served.snapshot.served_snapshot_id,
    queue_entry_id: served.snapshot.queue_entry_id,
    student_id: served.snapshot.student_id,
    item_id: served.snapshot.item_id,
    item_version: served.snapshot.item_version,
    selected_response: selected,
    correctness,
    branch_id: response.branch_id,
    back_blocks: branch.display_blocks ?? [],
    scoring_signals: scoringSignals,
    immediate_queue_proposal: proposal,
    next_action_summary: nextActionSummary(proposal, branch),
    attempt_event: attemptEvent,
  };
}

export function resolveLeadMeSubmit(
  served: ServedLeadMeSnapshot,
  request: LeadMeSubmitRequest,
  existing?: LeadMeSubmissionRecord | null,
): LeadMeSubmitResult {
  if (
    existing &&
    existing.queue_entry_id === request.queue_entry_id &&
    existing.idempotency_key === request.idempotency_key
  ) {
    return existing.result;
  }

  return evaluateLeadMeSubmit(served, request);
}
