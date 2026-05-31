// Pure adaptive selector for the C3 Coach (Phase 3). No DB/HTTP — unit-tested.
// Thompson sampling over per-mold Beta posteriors, exam-weight tilt, SM-2 spacing
// gate, and a neutral cohort-boost hook (=0 until Phase 5's item_live_stats lands).

import type { MoldRow } from "./c3-scoring.js";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) {
    const u = rng();
    return sampleGamma(1 + shape, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let iter = 0; iter < 1000; iter++) {
    let x = 0, v = 0;
    do {
      const u1 = Math.max(rng(), 1e-12), u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  throw new Error("sampleGamma: sampler did not converge");
}

export function sampleBeta(a: number, b: number, rng: Rng): number {
  const x = sampleGamma(a, rng);
  const y = sampleGamma(b, rng);
  const sum = x + y;
  return sum === 0 ? 0.5 : x / sum; // degenerate fallback (uniform) when both underflow to 0
}

export const PRIOR_A = 1;          // uniform Beta prior (cold start)
export const PRIOR_B = 1;
export const SPACING_PENALTY = 0.2; // multiplier when a mold is not yet due

export interface SelectInput {
  molds: MoldRow[];
  srsDue: Record<string, boolean>;   // mold_code -> due (true) | suppressed (false)
  boost?: Record<string, number>;    // Phase 5 cohort hook; defaults to 0 everywhere
  rng: Rng;
}

export interface ScoredMold { mold_code: string; score: number; deficit: number; }
export interface SelectResult {
  target_mold: string | null;
  deficit: number;                   // sampled deficit of the target
  ranking: ScoredMold[];             // score-desc
}

export function selectTarget(input: SelectInput): SelectResult {
  const boost = input.boost ?? {};
  const scored: ScoredMold[] = input.molds.map((m) => {
    const alpha = PRIOR_A + Math.max(0, m.w_exposure - m.w_bite);
    const beta = PRIOR_B + Math.max(0, m.w_bite);
    const theta = sampleBeta(alpha, beta, input.rng); // sampled proficiency
    const deficit = 1 - theta;
    const spacing = input.srsDue[m.mold_code] === false ? SPACING_PENALTY : 1;
    const b = boost[m.mold_code] ?? 0;
    const score = m.weight * (1 + deficit) * (1 + b) * spacing;
    return { mold_code: m.mold_code, score, deficit };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0] ?? null;
  return {
    target_mold: top ? top.mold_code : null,
    deficit: top ? top.deficit : 0,
    ranking: scored,
  };
}
