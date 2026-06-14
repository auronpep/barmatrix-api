// Pure helpers for the command-deck dashboard endpoint. No DB access here — all
// functions are deterministic and unit-tested in command-deck.test.ts.

// Cohort-wide MBE / California Bar day 1. Founder-set constant; there is no
// per-student exam_date column, so the countdown is shared across the cohort.
// UTC midnight.
export const EXAM_DATE_ISO = "2026-07-28";
export const SESSION_GOAL_MIN = 45;

const MS_PER_DAY = 86_400_000;

function utcDayNumber(year: number, monthZeroBased: number, day: number): number {
  return Math.floor(Date.UTC(year, monthZeroBased, day) / MS_PER_DAY);
}

function isoToDayNumber(iso: string): number {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / MS_PER_DAY);
}

/** Whole days from `now` to the exam date. 0 on exam day, null once passed. */
export function daysToExam(now: Date): number | null {
  const examDay = isoToDayNumber(EXAM_DATE_ISO);
  const todayDay = utcDayNumber(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = examDay - todayDay;
  return diff < 0 ? null : diff;
}

/**
 * Consecutive distinct attempt days ending today or yesterday.
 * `days` is ISO 'YYYY-MM-DD' strings, newest first (DESC).
 */
export function computeStreak(days: string[], now: Date): number {
  if (days.length === 0) return 0;
  const todayDay = utcDayNumber(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const newest = isoToDayNumber(days[0]);

  let expected: number;
  if (newest === todayDay) {
    expected = todayDay;
  } else if (newest === todayDay - 1) {
    expected = todayDay - 1;
  } else {
    return 0;
  }

  let streak = 0;
  for (const iso of days) {
    if (isoToDayNumber(iso) === expected) {
      streak += 1;
      expected -= 1;
    } else {
      break;
    }
  }
  return streak;
}

export interface SubjectMasteryRow {
  subject: string;
  att_recent: number;
  cor_recent: number;
  att_prior: number;
  cor_prior: number;
}

export interface SubjectMastery {
  subject: string;
  pct: number;
  delta: number;
  attempted: number;
}

/** Recent-window % correct + delta vs the prior window. Sorted weakest-first. */
export function shapeSubjectMastery(rows: SubjectMasteryRow[]): SubjectMastery[] {
  return rows
    .filter((r) => r.att_recent > 0)
    .map((r) => {
      const pct = Math.round((r.cor_recent / r.att_recent) * 100);
      const priorPct = r.att_prior > 0 ? Math.round((r.cor_prior / r.att_prior) * 100) : null;
      return {
        subject: r.subject,
        pct,
        delta: priorPct === null ? 0 : pct - priorPct,
        attempted: r.att_recent,
      };
    })
    .sort((a, b) => a.pct - b.pct || a.subject.localeCompare(b.subject));
}

// The 7 trap "dimensions" shown across the top of the personal tension matrix.
export const TENSION_COLS = [
  "Rule/Excptn",
  "Timing",
  "Party",
  "Scope",
  "Standard",
  "Triggers",
  "Remedy",
] as const;
export type TensionCol = (typeof TENSION_COLS)[number];

// Minimal, explicit forensic-tag-slug -> dimension map. Unknown slugs fall into
// Rule/Excptn (the catch-all). Extend as real tag coverage is confirmed against
// OFFICIAL_WRONG_ANSWER_ARCHITECTURES in lib/traps.ts.
const SLUG_DIMENSION: Record<string, TensionCol> = {
  wrong_rule: "Rule/Excptn",
  wrong_exception: "Rule/Excptn",
  stale_rule: "Rule/Excptn",
  common_law_default: "Rule/Excptn",
  wrong_timing: "Timing",
  then_existing: "Timing",
  wrong_party: "Party",
  party_opponent: "Party",
  wrong_scope: "Scope",
  container_limit: "Scope",
  wrong_standard: "Standard",
  decisionmaker_inversion: "Standard",
  modal_inversion: "Standard",
  wrong_trigger: "Triggers",
  channel_mismatch: "Triggers",
  wrong_remedy: "Remedy",
  remedy_mismatch: "Remedy",
};

export function trapSlugToDimension(slug: string): TensionCol {
  return SLUG_DIMENSION[slug] ?? "Rule/Excptn";
}

// Heat buckets: 0 misses=0, 1-2=1, 3-4=2, 5-7=3, 8-11=4, 12+=5.
function missToHeat(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  if (n <= 11) return 4;
  return 5;
}

export interface HeatRow {
  subject: string;
  trap_slug: string;
  miss_count: number;
}

export interface TensionMatrix {
  cols: readonly string[];
  rows: Array<{ name: string; heat: number[]; attempts: number[] }>;
}

/** Pivot per-subject forensic-tag miss counts into a subject x dimension grid. */
export function buildTensionMatrix(rows: HeatRow[]): TensionMatrix {
  const bySubject = new Map<string, number[]>();
  for (const r of rows) {
    const dimIdx = TENSION_COLS.indexOf(trapSlugToDimension(r.trap_slug));
    if (!bySubject.has(r.subject)) {
      bySubject.set(r.subject, new Array(TENSION_COLS.length).fill(0));
    }
    const arr = bySubject.get(r.subject)!;
    arr[dimIdx] += r.miss_count;
  }
  const out = [...bySubject.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, attempts]) => ({
      name,
      attempts,
      heat: attempts.map(missToHeat),
    }));
  return { cols: TENSION_COLS, rows: out };
}
