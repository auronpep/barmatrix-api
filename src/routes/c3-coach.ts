// GET /api/me/c3/next — the C3 Coach adaptive item endpoint. Thin: it wires DB
// rows into the pure selector (c3-bandit) + SM-2 (c3-srs). Missing-table tolerant
// and cold-start safe, mirroring routes/c3.ts.
import type { Family } from "../lib/c3-scoring.js";

export interface ServableChoice { choice_id: string; letter: string; choice_text: string; }
export interface ServableQuestion {
  question_id: string; external_id: string | null; subject: string;
  topic: string | null; subtopic: string | null; tension_point: string | null;
  fact_pattern: string; question_stem: string; call_of_question: string | null;
  choices: ServableChoice[];
}

export interface CoachMoldMeta {
  mold_code: string; name: string; family: Family;
  lesson_slug: string | null; deck_ref: string | null;
  exposures: number; bite_pct: number; measured: boolean;
}

export interface BuildPayloadInput {
  question: ServableQuestion;
  mold: CoachMoldMeta;
  deficit: number;
  coverage: { total_attempts: number; measured_attempts: number };
}

export function pickFromCandidates(candidates: string[], recentlySeen: Set<string>): string | null {
  if (candidates.length === 0) return null;
  return candidates.find((q) => !recentlySeen.has(q)) ?? candidates[0]!;
}

export function buildCoachPayload(input: BuildPayloadInput) {
  const { question, mold, deficit, coverage } = input;
  const pct = coverage.total_attempts > 0
    ? Math.round((coverage.measured_attempts / coverage.total_attempts) * 100) : 0;
  return {
    available: true as const,
    coverage: { ...coverage, pct },
    question,
    coaching: {
      target_mold: mold.mold_code, name: mold.name, family: mold.family,
      deficit_pct: Math.round(deficit * 100), exposures: mold.exposures, measured: mold.measured,
    },
    remediation: { lesson_slug: mold.lesson_slug, deck_ref: mold.deck_ref },
    cohort_signal: null,
  };
}
