// Pure fork-injection policy for the C3 Coach. No DB/HTTP — unit-tested.
//
// A target share of hard-tail (FORK_OR_SPLIT) items is woven into the student
// path so the coach teaches flag/coin discipline and calibration, not just
// mold remediation (handoff 06, triage A6). The share ramps with course
// progress, proxied by the number of C3-measured attempts the student has.

export interface ForkPhase {
  readonly name: "early" | "mid" | "late" | "integration";
  readonly maxMeasured: number; // upper bound (exclusive) of this phase
  readonly share: number; // target fork share in [0,1]
}

// Midpoints of the handoff's suggested bands (early 5–10%, mid 10–15%,
// late 15–25%, integration ~exam-like hard tail).
export const FORK_PHASES: readonly ForkPhase[] = [
  { name: "early", maxMeasured: 50, share: 0.075 },
  { name: "mid", maxMeasured: 150, share: 0.125 },
  { name: "late", maxMeasured: 300, share: 0.2 },
  { name: "integration", maxMeasured: Number.POSITIVE_INFINITY, share: 0.2 },
] as const;

/** Resolve the fork phase for a student's measured-attempt count. */
export function forkPhaseForProgress(measuredAttempts: number): ForkPhase {
  const m = Number.isFinite(measuredAttempts) ? Math.max(0, measuredAttempts) : 0;
  for (const phase of FORK_PHASES) {
    if (m < phase.maxMeasured) return phase;
  }
  // FORK_PHASES always ends with an Infinity bound, so this is unreachable;
  // kept as a defensive, non-null return.
  return FORK_PHASES[FORK_PHASES.length - 1]!;
}

/** Target fork share in [0,1] for a student's measured-attempt count. */
export function forkShareForProgress(measuredAttempts: number): number {
  return forkPhaseForProgress(measuredAttempts).share;
}

/**
 * Decide whether THIS item should be a fork-practice item.
 * rng() is expected in [0,1). Returns true with probability = target share.
 */
export function shouldInjectFork(measuredAttempts: number, rng: () => number): boolean {
  const share = forkShareForProgress(measuredAttempts);
  if (share <= 0) return false;
  const r = rng();
  return r >= 0 && r < share;
}
