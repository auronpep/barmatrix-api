// Pure per-item psychometrics for the adaptive engine (triage A4). No DB/HTTP.
// The handoff used Postgres views (width_bucket / jsonb_each); MariaDB has
// neither, so divergence + auto-review triggers are computed here in TS from
// rows the service gathers.

export const MIN_SAMPLE = 30; // handoff: live signal overrides prior at n >= 30
export const LOW_DISCRIMINATION = 0.1;
export const HIGH_FLAG_RATE = 0.25;
export const HIGH_DISTRACTOR_PULL = 0.5;

export type Difficulty = 1 | 2 | 3;

export interface ItemAttempt {
  studentAbility: number; // the student's overall p_correct (continuous ability proxy)
  correct: boolean;
  selectedLetter: string | null;
  flagged: boolean;
  timeMs: number | null;
}

export interface ItemStats {
  n_attempts: number;
  p_correct: number;
  discrimination: number | null; // point-biserial corr(correct, ability); null if undefined
  mean_time_ms: number | null;
  flag_rate: number;
  distractor_pull: Record<string, number>; // wrong-letter -> selection rate over all attempts
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Pearson correlation; null when either series has zero variance or n < 2. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

export function computeItemStats(attempts: ItemAttempt[], creditedLetter: string | null): ItemStats {
  const n = attempts.length;
  if (n === 0) {
    return { n_attempts: 0, p_correct: 0, discrimination: null, mean_time_ms: null, flag_rate: 0, distractor_pull: {} };
  }
  let correctN = 0, flaggedN = 0, timeSum = 0, timeN = 0;
  const wrongCounts: Record<string, number> = {};
  const xs: number[] = []; // correct 0/1
  const ys: number[] = []; // ability
  for (const a of attempts) {
    if (a.correct) correctN++;
    if (a.flagged) flaggedN++;
    if (a.timeMs != null) { timeSum += a.timeMs; timeN++; }
    if (a.selectedLetter && a.selectedLetter !== creditedLetter) {
      wrongCounts[a.selectedLetter] = (wrongCounts[a.selectedLetter] ?? 0) + 1;
    }
    xs.push(a.correct ? 1 : 0);
    ys.push(a.studentAbility);
  }
  const distractor_pull: Record<string, number> = {};
  for (const [letter, c] of Object.entries(wrongCounts)) distractor_pull[letter] = round3(c / n);
  const disc = pearson(xs, ys);
  return {
    n_attempts: n,
    p_correct: round3(correctN / n),
    discrimination: disc == null ? null : round3(disc),
    mean_time_ms: timeN > 0 ? Math.round(timeSum / timeN) : null,
    flag_rate: round3(flaggedN / n),
    distractor_pull,
  };
}

export function liveDifficulty(pCorrect: number): Difficulty {
  if (pCorrect >= 0.8) return 1;
  if (pCorrect >= 0.55) return 2;
  return 3;
}

/** live - prior. Positive = harder than the C3 prior; negative = easier. */
export function divergence(live: Difficulty, prior: Difficulty): number {
  return live - prior;
}

export function maxDistractorPull(pull: Record<string, number>): number {
  const vals = Object.values(pull);
  return vals.length === 0 ? 0 : Math.max(...vals);
}

export type ItemReviewReason = "LOW_DISCRIMINATION" | "HIGH_FLAG_RATE" | "DISTRACTOR_PULL";

/**
 * Auto-review trigger for an item's live stats. Returns null below MIN_SAMPLE or
 * when the item is healthy. Order mirrors the handoff's v_item_review_queue.
 */
export function reviewReasonForStats(stats: ItemStats, minSample: number = MIN_SAMPLE): ItemReviewReason | null {
  if (stats.n_attempts < minSample) return null;
  if (stats.discrimination != null && stats.discrimination <= LOW_DISCRIMINATION) return "LOW_DISCRIMINATION";
  if (stats.flag_rate >= HIGH_FLAG_RATE) return "HIGH_FLAG_RATE";
  if (maxDistractorPull(stats.distractor_pull) >= HIGH_DISTRACTOR_PULL) return "DISTRACTOR_PULL";
  return null;
}
