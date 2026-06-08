// J7 Guided "Lead Me" Path — pure engine.
//
// All scheduling DECISIONS live here: the enrollment-relative personal-day clock,
// dependency-aware "today first" selection, the 15-minute stall fallback, and the
// today-then-backlog overflow ordering. No DB, no HTTP, no ambient clock — every
// function is deterministic given its inputs (the clock is injected via `now`), so
// it is trivially unit-testable. The transactional persistence + signal reads live
// in routes/path.ts; the authored step script lives in path.data.ts.

export const STALL_MS = 15 * 60 * 1000; // 15 minutes
export const MILLIS_PER_DAY = 86_400_000;

export type PathStepKind =
  | "quiz_set"
  | "foundations_lesson"
  | "flashcard_deck"
  | "doctrinal_lesson"
  | "micro_read"
  | "reflect"
  | "celebrate";

// What the server checks to validate that a step is actually done. `self_declared`
// has no external signal — it is completed only by an explicit POST .../complete
// (the student acknowledged a read/reflection/celebration).
export type CompletionRule =
  | { kind: "quiz_attempts_count"; set_id: string; required: number }
  | { kind: "foundations_lesson_complete"; lesson_slug: string }
  | { kind: "flashcard_deck_reviewed"; deck_id: string; required: number }
  | { kind: "self_declared" };

// Where "Do it →" sends the student. `inline` renders inside the step card itself
// (a micro-read / reflection / celebration with no external surface).
export type PathStepTarget =
  | { kind: "route"; href: string }
  | { kind: "quiz"; set_id: string; question_ids: string[] }
  | { kind: "flashcard"; deck_id: string }
  | { kind: "doctrinal"; slug: string }
  | { kind: "inline" };

export interface PathStep {
  id: string; // stable across redeploys, e.g. "d1.s03"
  day: number; // 1-based; keys the per-day set (~50 tasks), a shared template
  order: number; // intended order within the day
  kind: PathStepKind;
  is_milestone: boolean; // Day 1 has 5 true milestones
  depends_on: string[]; // step ids that must be complete first; [] = dependency-free
  title: string;
  microcopy: string; // one line for the CTA card
  xp: number;
  target: PathStepTarget;
  completion_rule: CompletionRule;
  attorney_gated?: boolean; // items 1/4/5 — unavailable until content is approved/loaded
}

// The served-pointer row (student_path_state), mapped to engine types.
export interface PathState {
  current_day: number | null;
  active_step_id: string | null;
  active_step_shown_at: Date | null;
}

// Live signals the route assembles from the DB so step completion can be derived
// without a separate "first GET" backfill pass — every GET reconciles.
export interface CompletionSignals {
  foundationsCompleted: Set<string>; // lesson_slugs marked complete
  quizAttemptCounts: Map<string, number>; // set_id -> distinct answered question count
  flashcardReviewCounts: Map<string, number>; // deck_id -> distinct reviewed card count
}

export interface NextStep {
  step: PathStep | null;
  source: "today" | "backlog" | null;
  is_fallback: boolean;
}

export interface NextStepInput {
  steps: PathStep[];
  completedIds: ReadonlySet<string>;
  unavailableIds: ReadonlySet<string>;
  state: PathState;
  enrollmentDate: Date;
  now: Date;
  dayCount: number;
  stallMs?: number;
}

/** Midnight-UTC epoch ms for a Date's calendar day. */
function utcDayStart(d: Date): number {
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * The student's personal day index: whole UTC days since enrollment, 1-based,
 * clamped to [1, dayCount]. Past the last authored day the student stays on the
 * last day (today-first), and the derived backlog covers everything earlier.
 */
export function computeCurrentDay(
  enrollmentDate: Date,
  now: Date,
  dayCount: number,
): number {
  const diffDays = Math.floor(
    (utcDayStart(now) - utcDayStart(enrollmentDate)) / MILLIS_PER_DAY,
  );
  const day = diffDays + 1;
  if (day < 1) return 1;
  if (dayCount >= 1 && day > dayCount) return dayCount;
  return day;
}

/** Whether a step is completed via an existing live signal (never self_declared). */
export function signalSatisfiesStep(
  step: PathStep,
  signals: CompletionSignals,
): boolean {
  const r = step.completion_rule;
  switch (r.kind) {
    case "foundations_lesson_complete":
      return signals.foundationsCompleted.has(r.lesson_slug);
    case "quiz_attempts_count":
      return (signals.quizAttemptCounts.get(r.set_id) ?? 0) >= r.required;
    case "flashcard_deck_reviewed":
      return (signals.flashcardReviewCounts.get(r.deck_id) ?? 0) >= r.required;
    case "self_declared":
      return false;
  }
}

/**
 * Availability: an attorney-gated quiz is available once its question_ids are
 * loaded (founder hand-pick delivered); a gated doctrinal lesson is available
 * once approved (env flag, decided by the route). Anything else gated is
 * unavailable until approved. Unavailable steps are skipped as the active task
 * and don't gate day-completion — the path stays "completable around them".
 */
export function isStepAvailable(
  step: PathStep,
  opts: { doctrinalApproved: boolean },
): boolean {
  if (!step.attorney_gated) return true;
  if (step.target.kind === "quiz") return step.target.question_ids.length > 0;
  if (step.kind === "doctrinal_lesson") return opts.doctrinalApproved;
  return false;
}

function byOrder(a: PathStep, b: PathStep): number {
  return a.order - b.order;
}

/**
 * The single next task. Order of resolution:
 *   1. today's set: lowest-order incomplete available step whose deps are met;
 *   2. 15-min stall fallback: if that same step has been shown >= stallMs and is
 *      still incomplete, swap to a DIFFERENT dependency-free incomplete today step;
 *   3. backlog overflow: earlier-day incomplete available deps-met step;
 *   4. null when nothing is left (graduated).
 */
export function computeNextStep(input: NextStepInput): NextStep {
  const {
    steps,
    completedIds,
    unavailableIds,
    state,
    enrollmentDate,
    now,
    dayCount,
  } = input;
  const stallMs = input.stallMs ?? STALL_MS;
  const currentDay = computeCurrentDay(enrollmentDate, now, dayCount);

  const isOpen = (s: PathStep): boolean =>
    !completedIds.has(s.id) && !unavailableIds.has(s.id);
  const depsMet = (s: PathStep): boolean =>
    s.depends_on.every((d) => completedIds.has(d));

  const todayOpen = steps
    .filter((s) => s.day === currentDay && isOpen(s))
    .sort(byOrder);
  const primary = todayOpen.find(depsMet) ?? null;

  if (
    primary &&
    state.active_step_id === primary.id &&
    state.active_step_shown_at !== null &&
    now.getTime() - state.active_step_shown_at.getTime() >= stallMs
  ) {
    const fallback = todayOpen.find(
      (s) => s.id !== primary.id && s.depends_on.length === 0,
    );
    if (fallback) {
      return { step: fallback, source: "today", is_fallback: true };
    }
  }

  if (primary) {
    return { step: primary, source: "today", is_fallback: false };
  }

  const backlog = steps
    .filter((s) => s.day < currentDay && isOpen(s) && depsMet(s))
    .sort((a, b) => a.day - b.day || a.order - b.order);
  const backlogTop = backlog[0];
  if (backlogTop) {
    return { step: backlogTop, source: "backlog", is_fallback: false };
  }

  return { step: null, source: null, is_fallback: false };
}

export interface MilestoneState {
  step_id: string;
  title: string;
  kind: PathStepKind;
  day: number;
  order: number;
  completed: boolean;
  available: boolean;
}

export interface PathSummary {
  current_day: number;
  total_steps: number; // available steps across the whole path
  completed_steps: number;
  day_total_steps: number; // available steps in the current day
  day_completed_steps: number;
  day_complete: boolean;
  milestones: MilestoneState[];
}

/** Progress counts + the milestone map (all milestones across days, flagged). */
export function buildPathSummary(input: {
  steps: PathStep[];
  completedIds: ReadonlySet<string>;
  unavailableIds: ReadonlySet<string>;
  currentDay: number;
}): PathSummary {
  const { steps, completedIds, unavailableIds, currentDay } = input;
  const available = steps.filter((s) => !unavailableIds.has(s.id));
  const completedAvailable = available.filter((s) => completedIds.has(s.id));
  const dayAvailable = available.filter((s) => s.day === currentDay);
  const dayCompleted = dayAvailable.filter((s) => completedIds.has(s.id));

  const milestones = steps
    .filter((s) => s.is_milestone)
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((s) => ({
      step_id: s.id,
      title: s.title,
      kind: s.kind,
      day: s.day,
      order: s.order,
      completed: completedIds.has(s.id),
      available: !unavailableIds.has(s.id),
    }));

  return {
    current_day: currentDay,
    total_steps: available.length,
    completed_steps: completedAvailable.length,
    day_total_steps: dayAvailable.length,
    day_completed_steps: dayCompleted.length,
    day_complete: dayAvailable.length > 0 && dayCompleted.length === dayAvailable.length,
    milestones,
  };
}

// Client-facing step shape — drops the internal completion_rule, keeps the target
// (the app needs set_id/question_ids/deck_id/slug to drive the surface).
export interface PublicStep {
  id: string;
  day: number;
  kind: PathStepKind;
  is_milestone: boolean;
  title: string;
  microcopy: string;
  xp: number;
  target: PathStepTarget;
  is_fallback: boolean;
  source: "today" | "backlog" | null;
}

export function toPublicStep(next: NextStep): PublicStep | null {
  if (!next.step) return null;
  const s = next.step;
  return {
    id: s.id,
    day: s.day,
    kind: s.kind,
    is_milestone: s.is_milestone,
    title: s.title,
    microcopy: s.microcopy,
    xp: s.xp,
    target: s.target,
    is_fallback: next.is_fallback,
    source: next.source,
  };
}
