// Pure gamification logic for the Boot Camp surface — XP math, the account-wide
// day-streak transition, and badge eligibility. No DB, no HTTP, no clock: every
// function is deterministic given its inputs, so it is trivially unit-testable.
// The transactional persistence lives in gamification-store.ts.

export const CORRECT_XP = 10;
export const DAY_BONUS = 50;
export const MASTERY_BONUS = 200;

export const STREAK_3 = 3;
export const STREAK_7 = 7;
export const MASTERY_ACE_SCORE = 0.9;

export type BadgeSlug =
  | "first-day"
  | "halfway"
  | "perfect-day"
  | "camp-complete"
  | "mastery-ace"
  | "streak-3"
  | "streak-7"
  | "guided-day"
  | "catchup-clear";

export interface BadgeMeta {
  label: string;
  description: string;
  emoji: string;
}

export const BADGE_CATALOG: Record<BadgeSlug, BadgeMeta> = {
  "first-day": {
    label: "First Day Down",
    description: "Completed your first boot-camp day.",
    emoji: "🌱",
  },
  halfway: {
    label: "Halfway There",
    description: "Reached the midpoint of a boot camp.",
    emoji: "⛰️",
  },
  "perfect-day": {
    label: "Perfect Day",
    description: "Answered every question in a day correctly.",
    emoji: "💯",
  },
  "camp-complete": {
    label: "Camp Cleared",
    description: "Passed a boot camp's mastery check.",
    emoji: "🏁",
  },
  "mastery-ace": {
    label: "Mastery Ace",
    description: "Scored 90% or higher on a mastery check.",
    emoji: "🎯",
  },
  "streak-3": {
    label: "On a Roll",
    description: "Practiced three days in a row.",
    emoji: "🔥",
  },
  "streak-7": {
    label: "Unstoppable",
    description: "Practiced seven days in a row.",
    emoji: "⚡",
  },
  "guided-day": {
    label: "Guided Day Complete",
    description: "Completed a full Lead Me day.",
    emoji: "🧭",
  },
  "catchup-clear": {
    label: "Catchup Cleared",
    description: "Completed a missed micro-task from the catchup bank.",
    emoji: "✅",
  },
};

/** Format a Date as a UTC calendar date string (YYYY-MM-DD). */
export function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Whole-day difference between two YYYY-MM-DD strings (b - a), UTC. */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface StreakResult {
  current_streak: number;
  longest_streak: number;
  changed: boolean;
}

/**
 * Advance the account-wide day-streak for activity on `today`.
 * Same calendar day → unchanged. Consecutive day → +1. Any gap (or first
 * activity) → reset to 1. `longest_streak` never decreases.
 */
export function applyStreak(
  lastActiveDate: string | null,
  today: string,
  current: number,
  longest: number,
): StreakResult {
  if (lastActiveDate === today) {
    return { current_streak: current, longest_streak: longest, changed: false };
  }
  const next = lastActiveDate !== null && dayDiff(lastActiveDate, today) === 1 ? current + 1 : 1;
  return {
    current_streak: next,
    longest_streak: Math.max(longest, next),
    changed: true,
  };
}

/** XP for a completed day. A skipped day earns nothing. */
export function dayXp(correct: number, skipped: boolean): number {
  if (skipped) return 0;
  return Math.max(0, correct) * CORRECT_XP + DAY_BONUS;
}

/** XP for a completed mastery check. The bonus applies only on a pass. */
export function masteryXp(correct: number, mastered: boolean): number {
  return Math.max(0, correct) * CORRECT_XP + (mastered ? MASTERY_BONUS : 0);
}

export interface DayBadgeInput {
  day: number;
  dayCount: number;
  correct: number;
  dayQuestionCount: number;
}

/** Content badges earned by completing a day (streak badges are separate). */
export function evaluateDayContentBadges(input: DayBadgeInput): BadgeSlug[] {
  const out: BadgeSlug[] = ["first-day"];
  if (input.day >= Math.ceil(input.dayCount / 2)) out.push("halfway");
  if (input.dayQuestionCount > 0 && input.correct >= input.dayQuestionCount) {
    out.push("perfect-day");
  }
  return out;
}

/** Streak-milestone badges for the current streak length. */
export function evaluateStreakBadges(currentStreak: number): BadgeSlug[] {
  const out: BadgeSlug[] = [];
  if (currentStreak >= STREAK_3) out.push("streak-3");
  if (currentStreak >= STREAK_7) out.push("streak-7");
  return out;
}

export interface MasteryBadgeInput {
  score: number;
  mastered: boolean;
}

/** Badges earned by completing the mastery check. */
export function evaluateMasteryBadges(input: MasteryBadgeInput): BadgeSlug[] {
  const out: BadgeSlug[] = [];
  if (input.mastered) out.push("camp-complete");
  if (input.score >= MASTERY_ACE_SCORE) out.push("mastery-ace");
  return out;
}
