// Boot Camp pure helpers — Web Component 05.
//
// Everything in this file is a pure function: no DB, no I/O. The route layer
// (src/routes/boot-camps.ts) fetches candidate question IDs from the bank and
// records attempts; the math of pinning questions across days, scoring mastery,
// and advancing the current day lives here so it can be unit-tested without a
// live database (mirrors normalizeBySubjectParams in routes/questions.ts).

export type DayQuestionMap = Record<string, string[]>;

// A day's block advances when the student answered every pinned question for
// the day and got at least this fraction correct (sub-handoff 05: >= 9/12).
export const DAY_ADVANCE_RATIO = 0.75;

export interface PinDaysResult {
  days: DayQuestionMap;
  partial: boolean;
  pinnedTotal: number;
}

export interface PinMasteryResult {
  mastery: string[];
  partial: boolean;
}

/**
 * Distribute unique candidate question IDs into `dayCount` daily blocks of up
 * to `questionsPerDay` each. IDs are deduped first, then filled sequentially so
 * a question never repeats across days (pins are stable for resume). When the
 * pool is too small, later days are short and `partial` is true.
 */
export function pinDayQuestions(
  candidateIds: readonly string[],
  dayCount: number,
  questionsPerDay: number,
): PinDaysResult {
  const days: DayQuestionMap = {};
  const safeDayCount = Math.max(0, Math.trunc(dayCount));
  const safePerDay = Math.max(0, Math.trunc(questionsPerDay));
  const pool = uniqueStrings(candidateIds);

  let cursor = 0;
  let pinnedTotal = 0;
  for (let day = 1; day <= safeDayCount; day += 1) {
    const slice = pool.slice(cursor, cursor + safePerDay);
    days[String(day)] = slice;
    cursor += slice.length;
    pinnedTotal += slice.length;
  }

  const needed = safeDayCount * safePerDay;
  return { days, partial: pinnedTotal < needed, pinnedTotal };
}

/**
 * Pick up to `masteryCount` unique IDs for the end-of-camp mastery set. The
 * mastery set is allowed to reuse day questions (it is a mixed retest), so the
 * route passes its own shuffled candidate pool; isolation from day attempts is
 * handled by a separate set_id, not by excluding IDs here.
 */
export function pinMasteryQuestions(
  candidateIds: readonly string[],
  masteryCount: number,
): PinMasteryResult {
  const safeCount = Math.max(0, Math.trunc(masteryCount));
  const mastery = uniqueStrings(candidateIds).slice(0, safeCount);
  return { mastery, partial: mastery.length < safeCount };
}

/** Mastery score in [0,1]; total === 0 yields 0 (never NaN). */
export function computeMasteryScore(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  const ratio = correct / total;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

/** A mastery score passes when it meets or exceeds the camp threshold. */
export function isMasteryPassed(score: number, threshold: number): boolean {
  if (!Number.isFinite(score) || !Number.isFinite(threshold)) return false;
  return score >= threshold;
}

export interface DayCompletionInput {
  correctCount: number;
  answeredCount: number;
  dayQuestionCount: number;
  advanceRatio?: number;
}

export interface DayCompletionResult {
  allAnswered: boolean;
  passed: boolean;
  // Eligible to advance on its own merits (finished the block and hit the bar).
  // The route may still advance on an explicit skip; that is a route concern.
  eligibleToAdvance: boolean;
  score: number;
}

/**
 * Evaluate whether a day's block is finished and met the advance bar. A day is
 * only "eligible" when every pinned question was answered AND the correct ratio
 * meets `advanceRatio` (default DAY_ADVANCE_RATIO). Answering a subset never
 * advances, so resume can never skip unanswered questions.
 */
export function evaluateDayCompletion({
  correctCount,
  answeredCount,
  dayQuestionCount,
  advanceRatio = DAY_ADVANCE_RATIO,
}: DayCompletionInput): DayCompletionResult {
  const answered = Math.max(0, Math.trunc(answeredCount));
  const correct = Math.max(0, Math.trunc(correctCount));
  const required = Math.max(0, Math.trunc(dayQuestionCount));
  const allAnswered = required > 0 && answered >= required;
  const score = computeMasteryScore(correct, answered);
  const passed = allAnswered && score >= advanceRatio;
  return { allAnswered, passed, eligibleToAdvance: passed, score };
}

/**
 * Next value for boot_camp_sessions.current_day after completing `completedDay`.
 * Advances by exactly one only when the completed day IS the current day and we
 * are still within the camp — so repeated calls are idempotent. Once the last
 * day completes, current_day becomes dayCount + 1, which is the "mastery
 * unlocked" sentinel.
 */
export function nextCurrentDay(
  currentDay: number,
  completedDay: number,
  dayCount: number,
): number {
  const cur = Math.trunc(currentDay);
  const done = Math.trunc(completedDay);
  const total = Math.trunc(dayCount);
  if (done === cur && cur <= total) {
    return cur + 1;
  }
  return cur;
}

/** All daily blocks are finished; the mastery check is available. */
export function isMasteryUnlocked(currentDay: number, dayCount: number): boolean {
  return Math.trunc(currentDay) > Math.trunc(dayCount);
}

export type DayStatus = "complete" | "current" | "locked";

export interface DayProgress {
  day: number;
  status: DayStatus;
  total: number;
  answered: number;
  correct: number;
}

/**
 * Per-day progress for the session hub. `answeredByQuestion` maps a question_id
 * to whether it was answered correctly; only questions pinned to a day count
 * toward that day. Status is derived from current_day: earlier days are
 * complete, the current day is "current", later days are locked.
 */
export function summarizeDayProgress(
  dayQuestionIds: DayQuestionMap,
  currentDay: number,
  answeredByQuestion: ReadonlyMap<string, boolean>,
): DayProgress[] {
  const cur = Math.trunc(currentDay);
  return Object.keys(dayQuestionIds)
    .map((key) => Number.parseInt(key, 10))
    .filter((day) => Number.isFinite(day))
    .sort((a, b) => a - b)
    .map((day) => {
      const ids = dayQuestionIds[String(day)] ?? [];
      let answered = 0;
      let correct = 0;
      for (const id of ids) {
        if (answeredByQuestion.has(id)) {
          answered += 1;
          if (answeredByQuestion.get(id) === true) correct += 1;
        }
      }
      const status: DayStatus =
        day < cur ? "complete" : day === cur ? "current" : "locked";
      return { day, status, total: ids.length, answered, correct };
    });
}

/** Parse a `:day` route/query param into [1, dayCount], or null if invalid. */
export function parseDayParam(
  raw: unknown,
  dayCount: number,
): number | null {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > Math.trunc(dayCount)) return null;
  return value;
}

/** Flatten the pinned day map into a single ordered, deduped ID list. */
export function flattenDayQuestionIds(dayQuestionIds: DayQuestionMap): string[] {
  const all: string[] = [];
  for (const key of Object.keys(dayQuestionIds)) {
    for (const id of dayQuestionIds[key] ?? []) all.push(id);
  }
  return uniqueStrings(all);
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.length > 0 && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}
