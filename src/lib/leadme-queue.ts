export type LeadMeQueueStatus =
  | "available"
  | "served"
  | "viewed"
  | "started"
  | "completed"
  | "stalled"
  | "skipped"
  | "expired"
  | "blocked";

export type LeadMeRailScope =
  | "current_day"
  | "in_set_immediate"
  | "catchup"
  | "spaced_review"
  | "voluntary_outline"
  | "diagnostic_preview";

export interface LeadMeQueueEntry {
  queue_entry_id: string;
  student_id: string;
  item_id: string;
  item_version: string;
  content_hash: string;
  status: LeadMeQueueStatus;
  rail_scope: LeadMeRailScope;
  day_number: number | null;
  origin_day_number: number | null;
  priority: number;
  mandatory: boolean;
  dependency_free: boolean;
  available_at: Date | string | null;
  served_at?: Date | string | null;
  viewed_at?: Date | string | null;
  started_at?: Date | string | null;
  completed_at?: Date | string | null;
  stalled_at?: Date | string | null;
  stall_eligible_at?: Date | string | null;
  injection_depth?: number | null;
}

export interface QueueSelectionInput {
  now: Date;
  currentDay: number;
  allowCatchup?: boolean;
  allowSpacedReview?: boolean;
  stallMs?: number;
  maxImmediateDepth?: number;
}

export interface QueueSelection {
  entry: LeadMeQueueEntry | null;
  reason:
    | "current_served"
    | "stall_rotation"
    | "in_set_immediate"
    | "current_day"
    | "catchup"
    | "spaced_review"
    | "backlog"
    | "none";
  stalled_entry_id?: string;
}

const STALL_MS = 15 * 60 * 1000;

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isAvailable(entry: LeadMeQueueEntry, now: Date): boolean {
  return entry.status === "available" && (time(entry.available_at) ?? 0) <= now.getTime();
}

function isServedLike(entry: LeadMeQueueEntry): boolean {
  return entry.status === "served" || entry.status === "viewed" || entry.status === "started";
}

function lastProgressAt(entry: LeadMeQueueEntry): number | null {
  return time(entry.started_at) ?? time(entry.viewed_at) ?? time(entry.served_at);
}

function isStalled(entry: LeadMeQueueEntry, input: QueueSelectionInput): boolean {
  const explicit = time(entry.stall_eligible_at);
  if (explicit !== null) return explicit <= input.now.getTime();
  const last = lastProgressAt(entry);
  return last !== null && input.now.getTime() - last >= (input.stallMs ?? STALL_MS);
}

function byPriority(a: LeadMeQueueEntry, b: LeadMeQueueEntry): number {
  return b.priority - a.priority || a.queue_entry_id.localeCompare(b.queue_entry_id);
}

function top(entries: LeadMeQueueEntry[]): LeadMeQueueEntry | null {
  return [...entries].sort(byPriority)[0] ?? null;
}

export function chooseLeadMeQueueEntry(
  entries: readonly LeadMeQueueEntry[],
  input: QueueSelectionInput,
): QueueSelection {
  const served = entries.find(isServedLike) ?? null;
  if (served && !isStalled(served, input)) {
    return { entry: served, reason: "current_served" };
  }

  if (served) {
    const replacement = top(
      entries.filter(
        (entry) =>
          isAvailable(entry, input.now) &&
          entry.rail_scope === "current_day" &&
          entry.day_number === input.currentDay &&
          entry.dependency_free &&
          entry.queue_entry_id !== served.queue_entry_id,
      ),
    );
    if (replacement) {
      return {
        entry: replacement,
        reason: "stall_rotation",
        stalled_entry_id: served.queue_entry_id,
      };
    }
  }

  const maxImmediateDepth = input.maxImmediateDepth ?? 1;
  const available = entries.filter((entry) => isAvailable(entry, input.now));
  const immediate = top(
    available.filter(
      (entry) =>
        entry.rail_scope === "in_set_immediate" &&
        entry.mandatory &&
        (entry.injection_depth ?? 0) <= maxImmediateDepth,
    ),
  );
  if (immediate) return { entry: immediate, reason: "in_set_immediate" };

  const today = top(
    available.filter(
      (entry) =>
        entry.rail_scope === "current_day" &&
        entry.day_number === input.currentDay &&
        entry.dependency_free,
    ),
  );
  if (today) return { entry: today, reason: "current_day" };

  if (input.allowCatchup) {
    const catchup = top(
      available.filter(
        (entry) =>
          entry.rail_scope === "catchup" &&
          (entry.origin_day_number ?? entry.day_number ?? input.currentDay) < input.currentDay &&
          entry.dependency_free,
      ),
    );
    if (catchup) return { entry: catchup, reason: "catchup" };
  }

  if (input.allowSpacedReview) {
    const review = top(available.filter((entry) => entry.rail_scope === "spaced_review"));
    if (review) return { entry: review, reason: "spaced_review" };
  }

  const backlog = top(
    available.filter(
      (entry) =>
        entry.rail_scope === "current_day" &&
        (entry.day_number ?? input.currentDay) < input.currentDay &&
        entry.dependency_free,
    ),
  );
  if (backlog) return { entry: backlog, reason: "backlog" };

  return { entry: null, reason: "none" };
}
