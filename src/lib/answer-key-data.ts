// Answer Key debrief ("Combo B · Fork-First") data assembly.
//
// Maps real DB rows (questions + answer_choices + c3_annotations) into the
// DebriefData contract the app's <AnswerKeyDebrief> renders. The DB supplies the
// CORE (verdict, choices, why_*, c3 mold/filter, residual, dominant trap); the
// rich NARRATIVE (gold/silver keys, tension axis, trigger facts) lives in the
// case-study JSON store and is NOT yet ingested — those fields degrade to empty
// here and the component hides the corresponding blocks. Never returns null for
// an object the component dereferences.
//
// Pure + DB-free so it can be unit tested against fixture rows.

export type FactTone =
  | "easement"
  | "baseline"
  | "expanded"
  | "bait"
  | "selfhelp"
  | "call";

export interface DebriefRedZone {
  id: string;
  label: string;
  rank: number;
  dimension?: string | null;
  tag?: string | null;
}

export interface DebriefChoice {
  letter: string;
  correct: boolean;
  dominant: boolean;
  text: string;
  keyPhrase?: string;
  keyType?: FactTone;
  verdict: string;
  studentLabel?: string;
  mold?: string | null;
  moldFamily?: string | null;
  pull?: string;
  breaker?: string;
  trueResponsive?: string;
  lawyer?: string;
  fullRight?: string;
  fullWrong?: string;
  recovery?: string | null;
  redZone?: DebriefRedZone | null;
}

export interface TriggerFact {
  fact: string;
  role: string;
  use: string;
  type: FactTone;
}

export interface Mold {
  code: string;
  family: string;
  choice: string;
  tone: "bait" | "expanded" | "selfhelp" | "call";
  label: string;
  definition: string;
  tell: string;
}

export interface KeyCard {
  id: string;
  kind: string;
  statement: string;
  unlocks?: string;
  navigates?: string;
  trigger: string;
  testedChoice: string;
  authority?: string;
  outlineCode?: string;
}

export interface DebriefData {
  qid: string;
  subject: string;
  topic: string;
  subtopic: string;
  outlineCode: string;
  outlinePath: string;
  difficultyBand: string;
  mechanic: string;
  governingLane: string;

  correctLetter: string;
  dominantTrap: string;
  residual: string;
  callVerb: string;
  requestedRelief: string;
  call: string;
  callResolution: string;
  keyLegalQuestion: string;
  distilledCore: string;
  reviewTruth: string;
  prediction: string;
  finalScript: string;
  programFrame: string;

  /** Combo B §01 fork branch labels — data-driven so non-easement items don't
   *  read "violation / remedy". Default (when omitted) is the easement framing. */
  decoyBranchLabel?: string;
  askedBranchLabel?: string;

  stemSegments: string[];
  triggerFacts: TriggerFact[];
  choices: DebriefChoice[];
  molds: Mold[];

  cut: { letter: string; mold: string; note: string }[];
  clash: string;

  goldKey: KeyCard;
  silverKey: KeyCard;

  tension: { axis: string; resolver: string };

  remediation: {
    cardId: string;
    title: string;
    signal: string;
    studentMove: string;
    tinyRule: string;
    confidence: string;
    queueTitle: string;
    queueMeta: string;
  };

  redZone: DebriefRedZone;
}

/* ───────────────────────── DB row shapes ───────────────────────── */

export interface AkQuestionRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  tension_point: string | null;
  fact_pattern: string;
  question_stem: string;
  call_of_question: string | null;
  difficulty: number | string | null;
  metadata: unknown;
}

export interface AkChoiceRow {
  letter: string;
  choice_text: string;
  is_correct: number | boolean;
  why_attractive: string | null;
  why_wrong_or_correct: string | null;
  future_cue: string | null;
  remediation_id: string | null;
  forensic_tags: unknown;
  misconception_tags: unknown;
  c3_filter_broken: string | null;
  c3_mold_code: string | null;
  c3_architecture: string | null;
}

export interface AkAnnotationRow {
  verdict: string | null;
  residual: string | null;
  agrees_with_key: number | null;
  governing_law_type: string | null;
  deciding_phase: string | null;
  tension_axis_id: string | null;
  is_fork: number | null;
  fork_type: string | null;
  call_heuristic: string | null;
  difficulty: number | null;
  analyzer_notes: string | null;
}

/* ───────────────────────── helpers ───────────────────────── */

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* not JSON — ignore */
    }
  }
  return {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// "EAR_DISTORTION" / "wrong_element" → "Ear distortion" / "Wrong element".
function humanize(code: string | null | undefined): string {
  if (!code) return "";
  const spaced = code.replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Parse "dominant_trap: A" out of c3_annotations.analyzer_notes. */
export function parseDominantTrap(analyzerNotes: string | null | undefined): string | null {
  if (!analyzerNotes) return null;
  const m = /dominant[_ ]trap:\s*([A-D])/i.exec(analyzerNotes);
  return m?.[1] ? m[1].toUpperCase() : null;
}

// Where a choice sits on the fork: credited + unclassified defects sit on the
// "what's asked" side; NOT_TRUE / NOT_RESPONSIVE traps sit on the decoy side.
function forkTone(c: AkChoiceRow, correct: boolean): FactTone {
  if (correct) return "call";
  const f = (c.c3_filter_broken ?? "").toUpperCase();
  if (f === "NOT_TRUE") return "bait";
  if (f === "NOT_RESPONSIVE") return "expanded";
  return "selfhelp";
}

function moldTone(c: AkChoiceRow): "bait" | "expanded" | "selfhelp" | "call" {
  const f = (c.c3_filter_broken ?? "").toUpperCase();
  if (f === "NOT_TRUE") return "bait";
  if (f === "NOT_RESPONSIVE") return "expanded";
  return "selfhelp";
}

/* ───────────────────────── mapper ───────────────────────── */

export function buildDebriefData(
  q: AkQuestionRow,
  choiceRows: AkChoiceRow[],
  ann: AkAnnotationRow | null,
): DebriefData {
  const meta = asObject(q.metadata);
  const choices = [...choiceRows].sort((a, b) => a.letter.localeCompare(b.letter));

  const correctRow = choices.find((c) => c.is_correct === 1 || c.is_correct === true) ?? choices[0];
  const correctLetter = correctRow?.letter ?? "A";

  const dominantTrap =
    parseDominantTrap(ann?.analyzer_notes) ??
    choices.find((c) => c.letter !== correctLetter)?.letter ??
    "";

  const residual = (ann?.residual ?? correctLetter) || correctLetter;
  const callResolution = str(correctRow?.why_wrong_or_correct) || str(ann?.call_heuristic);
  const call = str(q.call_of_question);

  const debriefChoices: DebriefChoice[] = choices.map((c) => {
    const correct = c.is_correct === 1 || c.is_correct === true;
    const studentLabel = humanize(c.c3_mold_code) || humanize(c.c3_architecture) || (correct ? "the call's answer" : "distractor");
    const verdict = correct ? "the call's answer" : str(c.c3_filter_broken) || "distractor";
    return {
      letter: c.letter,
      correct,
      dominant: c.letter === dominantTrap,
      text: str(c.choice_text),
      keyType: forkTone(c, correct),
      verdict,
      studentLabel,
      mold: c.c3_mold_code,
      moldFamily: c.c3_architecture,
      pull: str(c.why_attractive),
      breaker: str(c.why_wrong_or_correct),
      // trueResponsive lives only in the case-study walkthrough (not in DB) — the
      // component hides the "what a true version says" box when it is empty.
      trueResponsive: "",
      fullRight: correct ? str(c.why_wrong_or_correct) : "",
      fullWrong: correct ? "" : str(c.why_wrong_or_correct),
      recovery: str(c.future_cue) || null,
    };
  });

  // Molds glossary: one card per distinct wrong-answer mold present in the bank row.
  const seenMold = new Set<string>();
  const molds: Mold[] = [];
  for (const c of choices) {
    const correct = c.is_correct === 1 || c.is_correct === true;
    if (correct || !c.c3_mold_code || seenMold.has(c.c3_mold_code)) continue;
    seenMold.add(c.c3_mold_code);
    molds.push({
      code: c.c3_mold_code,
      family: str(c.c3_architecture),
      choice: c.letter,
      tone: moldTone(c),
      label: humanize(c.c3_mold_code),
      definition: str(c.why_attractive),
      tell: str(c.future_cue),
    });
  }

  // Cut → Clash → Call board: every non-residual choice is a cut.
  const cut = choices
    .filter((c) => c.letter !== residual)
    .map((c) => ({
      letter: c.letter,
      mold: humanize(c.c3_mold_code),
      note: str(c.why_wrong_or_correct),
    }));

  const subtopic = str(q.subtopic);
  const tensionPoint = str(q.tension_point);
  const subject = str(q.subject);
  const redZoneLabel = tensionPoint || subtopic || subject || "this pattern";
  const redZoneDimension = tensionPoint ? "tension_point" : subtopic ? "subtopic" : subject ? "subject" : null;
  const redZoneTag = tensionPoint || subtopic || subject || null;

  // Empty key cards — the component hides the keys block when neither has a
  // statement. Populated for real once the program_intelligence JSON is ingested.
  const emptyKey = (kind: string): KeyCard => ({
    id: "", kind, statement: "", trigger: "", testedChoice: "",
  });

  return {
    qid: str(q.external_id) || q.question_id,
    subject,
    topic: str(q.topic),
    subtopic,
    outlineCode: str(meta.outline_code),
    outlinePath: "",
    difficultyBand: ann?.difficulty ? `band ${ann.difficulty}` : "",
    mechanic: humanize(choices.find((c) => c.letter === dominantTrap)?.c3_mold_code),
    governingLane: str(ann?.governing_law_type) || str(q.subject),

    correctLetter,
    dominantTrap,
    residual,
    callVerb: "",
    // requestedRelief lives in the case-study YAML; absent here. The component
    // falls back to the bare call when this is empty.
    requestedRelief: "",
    call,
    callResolution,
    keyLegalQuestion: call,
    distilledCore: "",
    reviewTruth: callResolution,
    prediction: "",
    finalScript: "",
    programFrame: "",

    // Generic, correct labels for any subject (defaults in the component keep the
    // easement fixture's "violation / remedy" wording).
    decoyBranchLabel: "The decoy — answers a different question",
    askedBranchLabel: "What the call actually asks",

    stemSegments: [str(q.fact_pattern), str(q.question_stem)].filter(Boolean),
    triggerFacts: [],
    choices: debriefChoices,
    molds,

    cut,
    clash: "",

    goldKey: emptyKey("rule"),
    silverKey: emptyKey("navigation"),

    tension: { axis: "", resolver: "" },

    remediation: {
      cardId: str(correctRow?.remediation_id) || "—",
      title: subtopic ? `Repair · ${subtopic}` : "Repair this pattern",
      signal: str(choices.find((c) => c.letter === dominantTrap)?.why_attractive),
      studentMove: str(choices.find((c) => c.letter === dominantTrap)?.future_cue),
      tinyRule: callResolution,
      confidence: str(meta.c3_confidence),
      queueTitle: subtopic || str(q.subject),
      queueMeta: str(q.subject),
    },

    redZone: {
      id: redZoneTag ?? "",
      label: redZoneLabel,
      rank: 0,
      dimension: redZoneDimension,
      tag: redZoneTag,
    },
  };
}
