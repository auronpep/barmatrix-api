// C3 automated solver/tagger (triage C2). Pure — no DB/HTTP/LLM. Unit-tested.
//
// DESIGN: deliberately conservative. The handoff's #1 guardrail is "NEEDS_HUMAN
// is never auto-repaired" and "do not overclaim structural certainty". So this
// analyzer ONLY proposes PASS when the credited answer is structurally clean AND
// every distractor has a detectable failure mode; otherwise it routes the item
// to NEEDS_HUMAN. It emits PROPOSALS only — the service enqueues them for a human
// to confirm; nothing here writes c3_annotations.
//
// Detectors are surface-pattern molds (overclaim absolutes, colloquial hedges).
// They are intentionally minimal and PLUGGABLE: add detectors, or swap in an
// LLM-backed analyzer, without changing the verdict/validation contract.

export type Letter = "A" | "B" | "C" | "D";
export type FilterBroken = "NOT_TRUE" | "NOT_RESPONSIVE";
export type SolverVerdict = "PASS" | "NEEDS_HUMAN";
export type SolverConfidence = "HEURISTIC_STRUCTURAL" | "HUMAN_REVIEW";

export interface SolverChoice {
  letter: Letter;
  text: string;
}
export interface SolverQuestion {
  subject?: string | null;
  stem?: string | null;
  call?: string | null;
  choices: SolverChoice[];
  credited_answer: Letter;
}

export interface DetectedMold {
  mold_code: string;
  family: string;
  filter_broken: FilterBroken;
  reason: string;
}

export interface ProposedDistractor {
  choice: Letter;
  filter_broken: FilterBroken;
  mold_code: string;
}

export interface C3AnnotationProposal {
  verdict: SolverVerdict;
  deciding_phase: "CUT" | null;
  confidence: SolverConfidence;
  residual: Letter | null;
  agrees_with_key: boolean | null;
  distractors: ProposedDistractor[];
  analyzer_notes: string;
}

// ── Detectors ───────────────────────────────────────────────────────────────
// Each detector inspects one choice's text and returns 0+ molds. mold_code /
// family must match seeded c3_molds rows.

type Detector = (text: string) => DetectedMold[];

const OVERCLAIM_RE =
  /\b(always|never|cannot|can never|must|in all cases|under no circumstances|guarantee[ds]?|automatically|absolutely|no exception|without exception)\b/i;
const COLLOQUIAL_RE = /\b(kind of|sort of|basically|pretty much|more or less)\b/i;

const detectOverclaim: Detector = (text) =>
  OVERCLAIM_RE.test(text)
    ? [{ mold_code: "tiered_absolute", family: "EAR_OVERCLAIM", filter_broken: "NOT_TRUE", reason: "absolute/overclaim language" }]
    : [];

const detectColloquial: Detector = (text) =>
  COLLOQUIAL_RE.test(text)
    ? [{ mold_code: "colloquialism", family: "EAR_DISTORTION", filter_broken: "NOT_TRUE", reason: "colloquial/vague phrasing" }]
    : [];

export const DEFAULT_DETECTORS: readonly Detector[] = [detectOverclaim, detectColloquial];

/** Run all detectors on a choice's text; first mold (if any) is the primary tag. */
export function detectMolds(text: string, detectors: readonly Detector[] = DEFAULT_DETECTORS): DetectedMold[] {
  return detectors.flatMap((d) => d(text ?? ""));
}

// ── Analyzer ──────────────────────────────────────────────────────────────────

export function analyzeQuestion(
  q: SolverQuestion,
  detectors: readonly Detector[] = DEFAULT_DETECTORS,
): C3AnnotationProposal {
  const needsHuman = (notes: string, distractors: ProposedDistractor[] = []): C3AnnotationProposal => ({
    verdict: "NEEDS_HUMAN", deciding_phase: null, confidence: "HUMAN_REVIEW",
    residual: null, agrees_with_key: null, distractors, analyzer_notes: notes,
  });

  if (q.choices.length !== 4) {
    return needsHuman(`expected 4 choices, got ${q.choices.length}`);
  }

  const detectedByLetter = new Map<Letter, DetectedMold[]>();
  for (const c of q.choices) detectedByLetter.set(c.letter, detectMolds(c.text, detectors));

  const credited = q.credited_answer;
  const creditedMolds = detectedByLetter.get(credited) ?? [];

  // The credited answer must be structurally clean for an auto-PASS. If a
  // detector fires on it, we cannot trust the surface heuristic — defer.
  if (creditedMolds.length > 0) {
    return needsHuman(
      `credited answer ${credited} triggered ${creditedMolds[0]!.mold_code}; surface heuristic cannot confirm — human review`,
    );
  }

  // Each of the 3 distractors must have ≥1 detectable failure mode.
  const distractors: ProposedDistractor[] = [];
  const untagged: Letter[] = [];
  for (const c of q.choices) {
    if (c.letter === credited) continue;
    const molds = detectedByLetter.get(c.letter) ?? [];
    const primary = molds[0];
    if (primary) {
      distractors.push({ choice: c.letter, filter_broken: primary.filter_broken, mold_code: primary.mold_code });
    } else {
      untagged.push(c.letter);
    }
  }

  if (untagged.length > 0) {
    return needsHuman(
      `${untagged.length}/3 distractor(s) [${untagged.join(",")}] had no detectable surface failure mode — human review`,
      distractors,
    );
  }

  return {
    verdict: "PASS",
    deciding_phase: "CUT",
    confidence: "HEURISTIC_STRUCTURAL",
    residual: credited,
    agrees_with_key: true,
    distractors,
    analyzer_notes: "Clean cut: credited answer carries no surface failure mode; all 3 distractors tagged by surface heuristic.",
  };
}

// ── Validation (triage A1/C5 invariants) ───────────────────────────────────────

export function validateProposal(p: C3AnnotationProposal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!p.confidence) errors.push("confidence is required");
  if (p.verdict === "PASS") {
    if (p.distractors.length !== 3) errors.push(`PASS requires exactly 3 distractor tags, got ${p.distractors.length}`);
    if (p.residual == null) errors.push("PASS requires a residual");
    const choices = new Set(p.distractors.map((d) => d.choice));
    if (choices.size !== p.distractors.length) errors.push("duplicate distractor choices");
    if (p.residual != null && choices.has(p.residual)) errors.push("residual must not be tagged as a distractor");
  }
  return { valid: errors.length === 0, errors };
}
