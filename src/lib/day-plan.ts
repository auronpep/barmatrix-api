export type DayPlanStepKind =
  | "orientation"
  | "diagnostic_question"
  | "lesson_slice"
  | "flashcard"
  | "criminal_lesson"
  | "micro_reflection"
  | "checkpoint"
  | "rule_gate"
  | "fact_trigger"
  | "distinction"
  | "trap_repair"
  | "question_bundle"
  | "wrong_answer_kill"
  | "catchup_repair";

export type DayPlanStepSource = "daily" | "catchup";

export interface DayPlanContentRef {
  type:
    | "diagnostic_question_external"
    | "diagnostic_set"
    | "foundation_lesson"
    | "c3_card"
    | "c3_drill"
    | "criminal_lesson"
    | "guided_microtask"
    | "reflection";
  id: string;
  label?: string;
  href?: string;
}

export interface DayPlanAction {
  label: string;
  href?: string;
}

export interface DayPlanMainItem {
  main_item_id: string;
  order: number;
  title: string;
  description: string;
  selectable: false;
  step_count: number;
}

export interface DayPlanStep {
  step_id: string;
  order: number;
  main_item_id: string;
  kind: DayPlanStepKind;
  title: string;
  prompt: string;
  estimated_seconds: number;
  content_ref: DayPlanContentRef;
  action: DayPlanAction;
  xp: number;
}

export interface DayPlanManifest {
  plan_key: string;
  version: string;
  day_index: number;
  title: string;
  approved: boolean;
  approved_at: string;
  timezone: string;
  rollover_hour: number;
  main_items: DayPlanMainItem[];
  steps: DayPlanStep[];
}

export interface CatchupCandidate {
  original_day_key: string;
  original_step_id: string;
  main_item_id: string;
  title: string;
  prompt: string;
  kind: DayPlanStepKind;
  content_ref: DayPlanContentRef;
  action: DayPlanAction;
  xp: number;
  missed_at: string;
}

export interface CatchupBankItem extends CatchupCandidate {
  catchup_id: string;
  student_id: string;
}

export interface LeadMeStep extends DayPlanStep {
  source: DayPlanStepSource;
  completed: boolean;
  catchup?: {
    catchup_id: string;
    original_day_key: string;
    original_step_id: string;
  };
}

export interface LeadMePath {
  plan_key: string;
  day_index: number;
  title: string;
  main_items: Array<
    DayPlanMainItem & {
      completed_steps: number;
      status: "complete" | "current" | "upcoming";
    }
  >;
  steps: LeadMeStep[];
  current_step: LeadMeStep | null;
  metrics: {
    total_daily_steps: number;
    completed_daily_steps: number;
    progress_pct: number;
  };
  catchup: {
    pending_count: number;
    injected_count: number;
    max_per_day: number;
    per_completed_milestone: number;
  };
}

export type DayPlanSummaryStatus = "active" | "locked" | "complete";

export interface DayPlanSummary {
  plan_key: string;
  day_index: number;
  title: string;
  description: string;
  approved: boolean;
  selectable: false;
  current: boolean;
  status: DayPlanSummaryStatus;
  milestone_count: number;
  step_count: number;
}

const DAY_CARD_COPY = {
  1: {
    title: "Day 1: Trap Hunt and C3 Power-Up",
    description: "Kick off the run: hunt the first remedy traps, unlock C3, and bank your opening streak.",
  },
  2: {
    title: "Day 2: Gate Builder and Trap Repair",
    description: "Level up the gates: rescue yesterday's misses, sharpen Procedure moves, and clear mixed traps.",
  },
  3: {
    title: "Day 3: Mixed-Set Boss Run",
    description: "Pressure run: switch Criminal Law and Procedure without handrails, then bridge to the next red zone.",
  },
} as const satisfies Record<number, { title: string; description: string }>;

const DIAGNOSTIC_A_ITEMS = [
  ["14556", "Illegal arrest remedy trap", "Unlawful arrest does not dismiss an indictment"],
  ["14561", "Grand jury exclusionary-rule posture", "Suppression rules do not control the grand jury room"],
  ["14590", "Suggestive identification reliability trap", "Suggestiveness affects admissibility only when reliability fails"],
  ["14601", "Voluntariness needs police coercion", "Mental state alone does not make a confession involuntary"],
  ["14610", "Grand jury counsel-location trap", "Counsel access changes outside the grand jury room"],
  ["14621", "Grand jury evidence gate", "Grand juries may consider evidence trial courts might later exclude"],
  ["14641", "Attempt mens rea for strict-liability crimes", "Attempt still requires the intent to commit the target offense"],
  ["14744", "Burglary intent-at-entry trap", "Burglary turns on intent when entry happens"],
  ["14563", "Plain-view after emergency entry", "Lawful emergency entry can make obvious evidence usable"],
  ["14616", "Private actor state-action trap", "A private search becomes constitutional only when government directs it"],
] as const;

const DIAGNOSTIC_B_ITEMS = [
  ["14630", "Factual impossibility attempt trap", "Fake contraband does not excuse a completed attempt"],
  ["14679", "Attempted murder transfer trap", "Transferred intent does not create attempt liability for the unintended victim"],
  ["14712", "Robbery force-or-fear gate", "Robbery needs present force or fear against a person"],
  ["14715", "Burglary accomplice entry-intent trap", "Liability follows the entry intent and the actor's assistance"],
  ["14745", "Pinkerton foreseeable-crime trap", "A conspirator can be liable for foreseeable crimes in furtherance"],
  ["14605", "Element burden-shift trap", "The state must prove every element beyond a reasonable doubt"],
  ["14660", "Omission legal-duty gate", "Moral blame is not homicide liability without a legal duty"],
  ["14676", "Suicide superseding-cause trap", "An independent suicide can break the homicide causation chain"],
  ["14696", "Preparation versus attempt line", "Attempt starts only after a substantial step toward the crime"],
  ["14700", "Solicitation complete-on-request trap", "Solicitation is complete when the criminal request is communicated"],
] as const;

const FOUNDATION_SLICES = [
  ["frame", "TRUE and RESPONSIVE frame", "Read the TRUE and RESPONSIVE frame."],
  ["truth-filter", "Truth filter", "Name what makes a choice not true."],
  ["responsive-filter", "Responsiveness filter", "Name what makes a choice true but not responsive."],
  ["break-discipline", "Break-before-answer discipline", "Practice saying the break before moving on."],
  ["filing-service-example", "Filing versus service contrast", "Review the filing versus service example."],
  ["ear-skill", "Ear versus Issue-Sense split", "Separate the Ear from Issue-Sense."],
  ["issue-sense", "Call-of-question lock", "Tie responsiveness to the exact call."],
  ["survivor", "Forced survivor check", "Confirm the survivor is forced, not preferred."],
  ["micro-check", "TRUE and RESPONSIVE method check", "Answer the short method check."],
  ["method-commit", "One-sentence method commitment", "Write the one-sentence method commitment."],
] as const;

const FLASHCARD_ITEMS = [
  ["CRIM-CUT-01", "Issue-cut flashcard", "Find the exact Criminal Law issue before doctrine drift."],
  ["CRIM-CLASH-01", "Rule-clash flashcard", "Name the competing rule or exception before choosing."],
  ["CRIM-CALL-01", "Call-of-question flashcard", "Answer the legal output the question actually asks for."],
  ["CRIM-ANCHOR-01", "Fact-anchor flashcard", "Anchor the answer to the fact that changes liability."],
  ["CRIM-DRIFT-01", "Doctrine-drift flashcard", "Stop switching crimes before the controlling variable is named."],
  ["CRIM-CP-CUT-01", "Procedure issue-cut flashcard", "Separate search, statement, identification, and remedy gates."],
  ["CRIM-CP-CLASH-01", "Procedure rule-clash flashcard", "Name the constitutional gate before the remedy."],
  ["CRIM-CP-CALL-01", "Procedure output flashcard", "Match suppression, dismissal, or admissibility to the call."],
  ["CRIM-CP-ANCHOR-01", "Procedure fact-anchor flashcard", "Use the custody, warrant, standing, or counsel fact that controls."],
  ["CRIM-GP-CUT-01", "General-principles issue-cut flashcard", "Sort attempt, conspiracy, causation, duty, and mental state first."],
] as const;

const CRIMINAL_DAY1_FLASHCARD_DECK_ID = "criminal-law-day1";

const CRIMINAL_LESSON_REFS = [
  ["layer-gate", "Layer before doctrine", "Name the criminal-law layer before doctrine."],
  ["output-gate", "Requested-output gate", "Find the requested output first."],
  ["actor-grid", "Controlling-actor grid", "Sort the actor who controls the result."],
  ["remedy-wall", "Violation-versus-remedy wall", "Separate violation from remedy."],
  ["timing-completion", "Timing and completion variable", "Mark the timing or completion variable."],
  ["mental-state", "Minimum mental-state gate", "Identify the minimum mental-state gate."],
  ["causation-force", "Causation, force, and possession check", "Check causation, force, and possession/title."],
  ["offense-label", "Offense-label discipline", "Do not compare crime names before the variable."],
  ["anchor-deck", "Smallest controlling anchor", "Use the smallest anchor that resolves the variable."],
  ["no-outline", "No-outline reset", "Stop any mini-outline drift and restate the variable."],
] as const;

export const DAY1_PLAN: DayPlanManifest = {
  plan_key: "j7-day-001",
  version: "2026-06-08.v1",
  day_index: 1,
  title: DAY_CARD_COPY[1].title,
  approved: true,
  approved_at: "2026-06-08",
  timezone: "America/Los_Angeles",
  rollover_hour: 3,
  main_items: [
    {
      main_item_id: "diagnostic-a",
      order: 1,
      title: "Criminal Procedure remedy traps",
      description: "Ten focused traps about arrest, grand jury, identification, confession, and search remedies.",
      selectable: false,
      step_count: 10,
    },
    {
      main_item_id: "foundations-c3",
      order: 2,
      title: "Foundations/C3 method lesson",
      description: "The first method lesson broken into tiny execution moves.",
      selectable: false,
      step_count: 10,
    },
    {
      main_item_id: "flashcards",
      order: 3,
      title: "Criminal Law trap flashcards",
      description: "Ten C3 cards for issue cuts, rule clashes, calls, anchors, and doctrine drift.",
      selectable: false,
      step_count: 10,
    },
    {
      main_item_id: "criminal-lesson",
      order: 4,
      title: "Criminal Law layer-gate lesson",
      description: "A short lesson on naming the layer, output, actor, timing, and remedy before doctrine.",
      selectable: false,
      step_count: 10,
    },
    {
      main_item_id: "diagnostic-b",
      order: 5,
      title: "Criminal Law liability traps",
      description: "Ten follow-up traps about attempt, homicide, robbery, burglary, conspiracy, and burdens.",
      selectable: false,
      step_count: 10,
    },
  ],
  steps: [
    ...DIAGNOSTIC_A_ITEMS.map(([id, title, label], index) =>
      step({
        order: index + 1,
        mainItemId: "diagnostic-a",
        kind: "diagnostic_question",
        title,
        prompt: `Answer the focused Criminal Law and Procedure question, then name the trap: ${label}.`,
        contentRef: {
          type: "diagnostic_question_external",
          id,
          label,
          href: "/diagnostic/session",
        },
        action: { label: "Answer question", href: "/diagnostic/session" },
        xp: 5,
      }),
    ),
    ...FOUNDATION_SLICES.map(([id, title, prompt], index) =>
      step({
        order: index + 11,
        mainItemId: "foundations-c3",
        kind: index === 9 ? "checkpoint" : "lesson_slice",
        title,
        prompt,
        contentRef: {
          type: "foundation_lesson",
          id: `lesson-01:${id}`,
          label: "Lesson 1: TRUE and RESPONSIVE",
          href: "/foundations/lesson-01",
        },
        action: { label: "Open lesson", href: "/foundations/lesson-01" },
        xp: 5,
      }),
    ),
    ...FLASHCARD_ITEMS.map(([id, title, label], index) => {
      const order = index + 21;
      const cardId = `c${String(index + 1).padStart(2, "0")}`;
      const href = `/flashcards/${CRIMINAL_DAY1_FLASHCARD_DECK_ID}?card=${cardId}&step=${day1StepId(order)}`;
      return step({
        order,
        mainItemId: "flashcards",
        kind: "flashcard",
        title,
        prompt: "Read the card, say the student move out loud, then mark it complete.",
        contentRef: {
          type: "c3_card",
          id,
          label,
          href,
        },
        action: { label: "Open flashcard", href },
        xp: 4,
      });
    }),
    ...CRIMINAL_LESSON_REFS.map(([id, title, prompt], index) =>
      step({
        order: index + 31,
        mainItemId: "criminal-lesson",
        kind: index === 9 ? "checkpoint" : "criminal_lesson",
        title,
        prompt,
        contentRef: {
          type: "criminal_lesson",
          id,
          label: "Criminal Law layer-gate lesson",
          href: "/drills/criminal-law",
        },
        action: { label: "Open Criminal Law drill", href: "/drills/criminal-law" },
        xp: 5,
      }),
    ),
    ...DIAGNOSTIC_B_ITEMS.map(([id, title, label], index) =>
      step({
        order: index + 41,
        mainItemId: "diagnostic-b",
        kind: "diagnostic_question",
        title,
        prompt: `Answer the focused follow-up question, then name the trap: ${label}.`,
        contentRef: {
          type: "diagnostic_question_external",
          id,
          label,
          href: "/diagnostic/session",
        },
        action: { label: "Answer question", href: "/diagnostic/session" },
        xp: 5,
      }),
    ),
  ],
};

const DAY2_REVIEW_PROMPTS = [
  "Review yesterday's first missed Criminal Law or Procedure pattern and name the broken filter.",
  "Clear one high-confidence miss before adding new doctrine.",
  "Convert one timing miss into a short future cue.",
  "Convert one actor or standing miss into a short future cue.",
  "Review one answer that was true but not responsive.",
  "Review one answer that added a fact or skipped the call.",
  "Name the next catchup task that can wait until after a milestone.",
  "Write the Day 2 entry command before starting Procedure gates.",
  "Confirm no catchup task is allowed to replace today's prescribed path.",
  "Checkpoint the one miss pattern to watch during Day 2.",
] as const;

const DAY2_CP_PROMPTS = [
  "Decide whether there was a government search by checking government action and reasonable expectation of privacy.",
  "Choose the warrant exception and name the limit that keeps it from overexpanding.",
  "Decide whether this defendant has standing to suppress the search result.",
  "Run custody, interrogation, warnings, waiver, and remedy for a Miranda issue.",
  "Separate Miranda counsel from Sixth Amendment counsel and formal-charge attachment.",
  "Decide what happens after a suggestive identification procedure.",
  "Decide whether exclusion is available and whether an exception saves the evidence.",
  "Repair consent, school-search, and private-actor authority traps.",
  "Sort burden shifting, jeopardy attachment, and immunity gates.",
  "Check Brady materiality, state constitutional protection, and death-penalty limits.",
] as const;

const DAY2_LAW_TRAP_PROMPTS = [
  "Classify no-death killing facts as attempt, solicitation, conspiracy, or no completed homicide.",
  "Decide whether the facts cross the substantial-step line and kill impossibility bait.",
  "Sort request, agreement, overt act, hired actor, and conspiracy exception facts.",
  "Sort theft crimes by possession, title, fraud, stolen status, movement, and later consent.",
  "Check burglary intent, lawful entry, claim of right, force timing, and threat timing.",
  "Separate accomplice, accessory after the fact, innocent-agent, mere-presence, and stake-in-venture facts.",
  "Decide whether malice and causation survive the homicide facts.",
  "Repair mitigation, mistake, intoxication, and self-defense traps.",
  "Sort arson, concurrence, dual-conviction, and lesser-included output traps.",
  "Write the Day 2 Criminal Law trap sequence and convert one miss into a reusable cue.",
] as const;

const DAY2_DOC_PROMPTS = [
  "Repair the felony-murder merger and intoxication-degree traps.",
  "Sort robbery, attempted robbery, and words-alone assault traps.",
  "Decide which conspiracy or solicitation exception controls.",
  "Sort theft crimes by consent, title, and property status.",
  "Check burglary, arson, and false-pretenses building and fact gates.",
  "Sort accomplice liability by assistance, purpose, and foreseeable crimes.",
  "Sort accessory after the fact, active concealment, and corporate-officer delegation.",
  "Decide which defenses are available and which are blocked.",
  "Sort mistake, strict-liability attempt reinforcement, and impossibility.",
  "Kill five answer-pattern traps from the keep-sharp and answer-intelligence sections.",
] as const;

const DAY2_MIXED_PROMPTS = [
  "Classify three stems by the controlling hinge before naming doctrine.",
  "Identify whose right, status, property, or proceeding controls the answer.",
  "Freeze the legally relevant time for intent, aid, custody, or counsel attachment.",
  "Sort scope limits across property-crime facts and search-authority facts.",
  "Decide whether status controls stolen property, title, standing, or procedural remedy.",
  "Kill answers that jump from illegality to the wrong remedy or procedural output.",
  "Kill five broad answers by naming the missing legal condition.",
  "Switch among property, participation, search, and statement traps without topic labels.",
  "Convert one mixed miss into a trap-family review note, not a copied rule outline.",
  "Write the Day 2 mixed-drill command sequence before the Day 3 pressure sets.",
] as const;

const DAY3_HOMICIDE_PROMPTS = [
  "Audit whether a missed homicide answer used implied malice before felony-murder shortcuts.",
  "Name the causation link and decide whether an intervening act breaks it.",
  "Apply the correct review standard before changing a homicide verdict.",
  "Separate mercy motive, words-only provocation, intoxication, deliberation, and second-degree fallback.",
  "Decide whether intoxication, recklessness, reasonableness, or final force controls the result.",
  "Kill the answer that ignores arson death consequences or dual-conviction output.",
  "Decide whether a reasonable mistake eliminates the mental state for homicide liability.",
  "Separate instruction entitlement from sufficiency review.",
  "Kill five homicide wrong answers by naming the missing mental-state, causation, defense, or output gate.",
  "Write the homicide recovery command sequence before starting the Day 3 pressure sets.",
] as const;

const DAY3_CP_PROMPTS = [
  "Handle vehicle, pretext-stop, and passenger-exit facts under time pressure.",
  "Kill the Miranda answer that treats hope or silence as interrogation.",
  "Split private action, school action, and government-directed action.",
  "Decide when exclusion is unavailable or saved despite a rights violation.",
  "Sort reasonable-expectation, third-party consent, and standing in three fast scenarios.",
  "Repair identification and counsel traps after formal charges.",
  "Separate burden-shift due process from double-jeopardy attachment.",
  "Sort testimonial compulsion, physical evidence, writings, and immunity.",
  "Resolve Brady, state-constitution, and death-penalty limit calls.",
  "Kill five high-frequency Criminal Procedure wrong-answer patterns.",
] as const;

const DAY3_LAW_PROMPTS = [
  "Classify the answer-pattern trap before applying doctrine.",
  "Kill five Criminal Law answer choices by naming the legal defect.",
  "Identify when a precise answer structure is legally stronger than an instinctive answer.",
  "Repair homicide degree traps under pressure.",
  "Sort theft and property-crime signals by timing, title, consent, and force.",
  "Sort attempt, solicitation, conspiracy, impossibility, and merger under pressure.",
  "Resolve close-call pairs by identifying the one fact that changes the result.",
  "Repair defense and responsibility traps that look morally tempting.",
  "Kill counter-intuitive Criminal Law answers by separating moral instinct from legal output.",
  "Write the Criminal Law pressure-check sequence for the next mixed set.",
] as const;

const DAY3_MIXED_PROMPTS = [
  "Classify three calls as Criminal Law liability, Criminal Procedure admissibility, or later-stage remedy.",
  "Translate three stems into the exact legal output requested before reading answers.",
  "Kill wrong answers by naming whether they fail on issue, actor, timing, or remedy.",
  "Choose the narrower fact-tethered answer when two choices reach a similar result.",
  "Switch among Fourth, Fifth, and Sixth Amendment frames without topic labels.",
  "Switch among homicide, theft, and inchoate Criminal Law frames without topic labels.",
  "Resolve three mixed close calls by identifying the one fact that changes the result.",
  "X-ray five final answer pairs for scope, timing, actor, remedy, and element fit.",
  "Write the mixed-execution command sequence before the final mixed diagnostic.",
  "Convert one missed mixed question into a reusable trap pattern and next cue.",
] as const;

const DAY3_FINAL_PROMPTS = [
  "Answer the first final mixed diagnostic question without topic cues.",
  "Answer the second final mixed diagnostic question without topic cues.",
  "Answer the third final mixed diagnostic question without topic cues.",
  "Answer the fourth final mixed diagnostic question without topic cues.",
  "Answer the fifth final mixed diagnostic question without topic cues.",
  "Review the final diagnostic's strongest Criminal Law miss.",
  "Review the final diagnostic's strongest Criminal Procedure miss.",
  "Choose the next catchup-bank target after the final milestone.",
  "Write the next-subject bridge cue from the Day 3 profile.",
  "Checkpoint the three-day Criminal Law/Procedure readiness profile.",
] as const;

export const DAY2_PLAN: DayPlanManifest = {
  plan_key: "j7-crimpro-day-002",
  version: "2026-06-08.v1",
  day_index: 2,
  title: DAY_CARD_COPY[2].title,
  approved: true,
  approved_at: "2026-06-08",
  timezone: DAY1_PLAN.timezone,
  rollover_hour: DAY1_PLAN.rollover_hour,
  main_items: [
    mainItem("miss-review", 1, "Miss review and catchup injection", "Start from yesterday's misses without delaying the prescribed path."),
    mainItem("crimpro-core", 2, "Criminal Procedure core gates", "Search, seizure, statement, identification, counsel, and exclusion gates."),
    mainItem("crimlaw-trap-repair", 3, "Criminal Law expansion and trap repair", "Inchoate, property, role-liability, defense, and answer-pattern traps."),
    mainItem("crimlaw-doc-continuation", 4, "Criminal Law document continuation", "Ten continuation tasks from approved Criminal Law source material."),
    mainItem("mixed-drill", 5, "Mixed Criminal Law/Procedure drill", "Switch between doctrine families without turning the day into a menu."),
  ],
  steps: [
    ...guidedSteps(2, 1, "miss-review", "catchup_repair", "D2-L01", "Day 2 catchup readiness", DAY2_REVIEW_PROMPTS),
    ...guidedSteps(2, 11, "crimpro-core", "rule_gate", "CRIMPRO-D2-CORE", "Criminal Procedure core gate", DAY2_CP_PROMPTS),
    ...guidedSteps(2, 21, "crimlaw-trap-repair", "trap_repair", "CRIMLAW-D2-TRAP", "Criminal Law trap repair", DAY2_LAW_TRAP_PROMPTS),
    ...guidedSteps(2, 31, "crimlaw-doc-continuation", "criminal_lesson", "CRIM-D2-DOC", "Criminal Law continuation", DAY2_DOC_PROMPTS),
    ...guidedSteps(2, 41, "mixed-drill", "question_bundle", "MIXED-D2-DRILL", "Mixed Criminal Law/Procedure drill", DAY2_MIXED_PROMPTS),
  ],
};

export const DAY3_PLAN: DayPlanManifest = {
  plan_key: "j7-crimpro-day-003",
  version: "2026-06-08.v1",
  day_index: 3,
  title: DAY_CARD_COPY[3].title,
  approved: true,
  approved_at: "2026-06-08",
  timezone: DAY1_PLAN.timezone,
  rollover_hour: DAY1_PLAN.rollover_hour,
  main_items: [
    mainItem("homicide-pattern-audit", 1, "Pattern audit and targeted recovery", "Convert repeated misses into explicit repair work before pressure sets."),
    mainItem("crimpro-pressure", 2, "Criminal Procedure pressure set", "Apply Procedure gates under time pressure and answer-choice bait."),
    mainItem("crimlaw-pressure", 3, "Criminal Law pressure set", "Apply Criminal Law gates under time pressure and mixed facts."),
    mainItem("mixed-execution", 4, "Mixed MBE execution", "Practice Criminal Law and Procedure in mixed order with no topic cues."),
    mainItem("final-diagnostic", 5, "Final diagnostic and next-subject bridge", "Create the profile that launches the next guided subject clone."),
  ],
  steps: [
    ...guidedSteps(3, 1, "homicide-pattern-audit", "trap_repair", "HOMICIDE-D3-AUDIT", "Homicide pattern audit", DAY3_HOMICIDE_PROMPTS),
    ...guidedSteps(3, 11, "crimpro-pressure", "question_bundle", "CRIMPRO-D3-PRESS", "Criminal Procedure pressure", DAY3_CP_PROMPTS),
    ...guidedSteps(3, 21, "crimlaw-pressure", "wrong_answer_kill", "CRIMLAW-D3-PRESS", "Criminal Law pressure", DAY3_LAW_PROMPTS),
    ...guidedSteps(3, 31, "mixed-execution", "question_bundle", "MIXED-D3-EXEC", "Mixed MBE execution", DAY3_MIXED_PROMPTS),
    ...guidedSteps(3, 41, "final-diagnostic", "diagnostic_question", "D3-FINAL-DX", "Final mixed diagnostic", DAY3_FINAL_PROMPTS),
  ],
};

export const DAY_GUIDED_PLANS: readonly DayPlanManifest[] = [DAY1_PLAN, DAY2_PLAN, DAY3_PLAN];

export function validateDayPlanStructure(manifest: DayPlanManifest): string[] {
  return validateManifest(manifest, { requireApproved: false });
}

export function buildDayPlanSummaries(input: {
  manifests: readonly DayPlanManifest[];
  activePlanKey: string;
  completedPlanKeys?: ReadonlySet<string>;
}): DayPlanSummary[] {
  const completedPlanKeys = input.completedPlanKeys ?? new Set<string>();
  return input.manifests.map((manifest) => {
    const current = manifest.plan_key === input.activePlanKey;
    return {
      plan_key: manifest.plan_key,
      day_index: manifest.day_index,
      title: manifest.title,
      description: dayPlanDescription(manifest.day_index),
      approved: manifest.approved,
      selectable: false,
      current,
      status: completedPlanKeys.has(manifest.plan_key) ? "complete" : current ? "active" : "locked",
      milestone_count: manifest.main_items.length,
      step_count: manifest.steps.length,
    };
  });
}

export function validateDayPlanManifest(manifest: DayPlanManifest): string[] {
  return validateManifest(manifest, { requireApproved: true });
}

function validateManifest(
  manifest: DayPlanManifest,
  options: { requireApproved: boolean },
): string[] {
  const errors: string[] = [];
  if (options.requireApproved && !manifest.approved) errors.push("manifest must be approved");
  if (manifest.main_items.length < 3 || manifest.main_items.length > 5) {
    errors.push("manifest must have 3-5 main items");
  }
  if (manifest.steps.length !== 50) errors.push("manifest must have exactly 50 steps");

  const stepIds = new Set<string>();
  const orders = new Set<number>();
  const mainItemIds = new Set(manifest.main_items.map((item) => item.main_item_id));
  for (const item of manifest.main_items) {
    if (item.selectable !== false) errors.push(`${item.main_item_id} must not be selectable`);
    const count = manifest.steps.filter((step) => step.main_item_id === item.main_item_id).length;
    if (count !== item.step_count) {
      errors.push(`${item.main_item_id} step_count ${item.step_count} does not match ${count}`);
    }
  }
  for (const step of manifest.steps) {
    if (stepIds.has(step.step_id)) errors.push(`duplicate step id ${step.step_id}`);
    stepIds.add(step.step_id);
    if (orders.has(step.order)) errors.push(`duplicate step order ${step.order}`);
    orders.add(step.order);
    if (!mainItemIds.has(step.main_item_id)) {
      errors.push(`${step.step_id} references unknown main item ${step.main_item_id}`);
    }
    if (!step.content_ref.type || !step.content_ref.id) {
      errors.push(`${step.step_id} must have an explicit content ref`);
    }
  }
  for (let i = 1; i <= manifest.steps.length; i += 1) {
    if (!orders.has(i)) errors.push(`missing step order ${i}`);
  }
  return errors;
}

export function programDayKey(
  now: Date,
  timeZone = DAY1_PLAN.timezone,
  rolloverHour = DAY1_PLAN.rollover_hour,
): string {
  const shifted = new Date(now.getTime() - rolloverHour * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function contentRefKey(ref: DayPlanContentRef): string {
  return `${ref.type}:${ref.id}`;
}

export function catchupCandidatesForRollover(input: {
  manifest: DayPlanManifest;
  originalDayKey: string;
  completedStepIds: ReadonlySet<string>;
  existingCatchupContentRefs: ReadonlySet<string>;
  missedAt: Date;
}): CatchupCandidate[] {
  return input.manifest.steps
    .filter((step) => !input.completedStepIds.has(step.step_id))
    .filter((step) => !input.existingCatchupContentRefs.has(contentRefKey(step.content_ref)))
    .map((step) => ({
      original_day_key: input.originalDayKey,
      original_step_id: step.step_id,
      main_item_id: step.main_item_id,
      title: step.title,
      prompt: step.prompt,
      kind: step.kind,
      content_ref: step.content_ref,
      action: step.action,
      xp: step.xp,
      missed_at: input.missedAt.toISOString(),
    }));
}

export function buildLeadMePath(input: {
  manifest: DayPlanManifest;
  completedDailyStepIds: ReadonlySet<string>;
  completedCatchupIds: ReadonlySet<string>;
  catchupBank: readonly CatchupBankItem[];
  perCompletedMilestone?: number;
  maxCatchupPerDay?: number;
}): LeadMePath {
  const perCompletedMilestone = input.perCompletedMilestone ?? 2;
  const maxCatchupPerDay = input.maxCatchupPerDay ?? 8;
  const todayRefs = new Set(input.manifest.steps.map((step) => contentRefKey(step.content_ref)));
  const sortedCatchup = [...input.catchupBank]
    .filter((item) => !input.completedCatchupIds.has(item.catchup_id))
    .sort(compareCatchup);
  const injectedCatchupIds = new Set<string>();
  const steps: LeadMeStep[] = [];

  for (const item of input.manifest.main_items) {
    const dailySteps = input.manifest.steps
      .filter((step) => step.main_item_id === item.main_item_id)
      .sort((a, b) => a.order - b.order);
    for (const daily of dailySteps) {
      steps.push({
        ...daily,
        source: "daily",
        completed: input.completedDailyStepIds.has(daily.step_id),
      });
    }

    const itemComplete = dailySteps.every((step) => input.completedDailyStepIds.has(step.step_id));
    if (!itemComplete || injectedCatchupIds.size >= maxCatchupPerDay) continue;

    let injectedAfterItem = 0;
    for (const catchup of sortedCatchup) {
      if (injectedAfterItem >= perCompletedMilestone) break;
      if (injectedCatchupIds.size >= maxCatchupPerDay) break;
      if (injectedCatchupIds.has(catchup.catchup_id)) continue;
      if (todayRefs.has(contentRefKey(catchup.content_ref))) continue;
      injectedCatchupIds.add(catchup.catchup_id);
      injectedAfterItem += 1;
      steps.push({
        step_id: catchup.catchup_id,
        order: steps.length + 1,
        main_item_id: item.main_item_id,
        kind: catchup.kind,
        title: `Catchup: ${catchup.title}`,
        prompt: catchup.prompt,
        estimated_seconds: 90,
        content_ref: catchup.content_ref,
        action: catchup.action,
        xp: catchup.xp,
        source: "catchup",
        completed: input.completedCatchupIds.has(catchup.catchup_id),
        catchup: {
          catchup_id: catchup.catchup_id,
          original_day_key: catchup.original_day_key,
          original_step_id: catchup.original_step_id,
        },
      });
    }
  }

  const completedDaily = input.manifest.steps.filter((step) =>
    input.completedDailyStepIds.has(step.step_id),
  ).length;
  const mainItems: LeadMePath["main_items"] = input.manifest.main_items.map((item) => {
    const itemSteps = input.manifest.steps.filter((step) => step.main_item_id === item.main_item_id);
    const completed = itemSteps.filter((step) => input.completedDailyStepIds.has(step.step_id)).length;
    const priorIncomplete = input.manifest.main_items
      .filter((candidate) => candidate.order < item.order)
      .some((candidate) =>
        input.manifest.steps
          .filter((step) => step.main_item_id === candidate.main_item_id)
          .some((step) => !input.completedDailyStepIds.has(step.step_id)),
      );
    const status: "complete" | "current" | "upcoming" = completed === itemSteps.length
      ? "complete"
      : priorIncomplete
        ? "upcoming"
        : "current";
    return {
      ...item,
      completed_steps: completed,
      status,
    };
  });

  return {
    plan_key: input.manifest.plan_key,
    day_index: input.manifest.day_index,
    title: input.manifest.title,
    main_items: mainItems,
    steps,
    current_step: steps.find((step) => !step.completed) ?? null,
    metrics: {
      total_daily_steps: input.manifest.steps.length,
      completed_daily_steps: completedDaily,
      progress_pct: Math.round((completedDaily / input.manifest.steps.length) * 100),
    },
    catchup: {
      pending_count: sortedCatchup.length,
      injected_count: injectedCatchupIds.size,
      max_per_day: maxCatchupPerDay,
      per_completed_milestone: perCompletedMilestone,
    },
  };
}

function step(input: {
  order: number;
  mainItemId: string;
  kind: DayPlanStepKind;
  title: string;
  prompt: string;
  contentRef: DayPlanContentRef;
  action: DayPlanAction;
  xp: number;
}): DayPlanStep {
  return {
    step_id: `j7d1-s${String(input.order).padStart(2, "0")}`,
    order: input.order,
    main_item_id: input.mainItemId,
    kind: input.kind,
    title: input.title,
    prompt: input.prompt,
    estimated_seconds: input.kind === "diagnostic_question" ? 120 : 90,
    content_ref: input.contentRef,
    action: input.action,
    xp: input.xp,
  };
}

function day1StepId(order: number): string {
  return `j7d1-s${String(order).padStart(2, "0")}`;
}

function mainItem(
  mainItemId: string,
  order: number,
  title: string,
  description: string,
): DayPlanMainItem {
  return {
    main_item_id: mainItemId,
    order,
    title,
    description,
    selectable: false,
    step_count: 10,
  };
}

function guidedSteps(
  dayIndex: 2 | 3,
  startOrder: number,
  mainItemId: string,
  kind: DayPlanStepKind,
  contentRefPrefix: string,
  contentRefLabel: string,
  prompts: readonly string[],
): DayPlanStep[] {
  return prompts.map((prompt, index) => {
    const order = startOrder + index;
    const contentOrder = String(index + 1).padStart(3, "0");
    return {
      step_id: `j7cp-d${dayIndex}-s${String(order).padStart(3, "0")}`,
      order,
      main_item_id: mainItemId,
      kind: index === prompts.length - 1 ? "checkpoint" : kind,
      title: `${contentRefLabel} ${index + 1}`,
      prompt,
      estimated_seconds: kind === "diagnostic_question" || kind === "question_bundle" ? 120 : 90,
      content_ref: {
        type: kind === "diagnostic_question" ? "diagnostic_set" : "guided_microtask",
        id: `${contentRefPrefix}-${contentOrder}`,
        label: `${contentRefLabel} ${index + 1}`,
      },
      action: { label: kind === "diagnostic_question" ? "Answer question" : "Continue" },
      xp: kind === "diagnostic_question" ? 5 : 4,
    };
  });
}

function dayPlanDescription(dayIndex: number): string {
  return DAY_CARD_COPY[dayIndex as keyof typeof DAY_CARD_COPY]?.description ?? "Guided BarMatrix path.";
}

function compareCatchup(a: CatchupBankItem, b: CatchupBankItem): number {
  const day = a.original_day_key.localeCompare(b.original_day_key);
  if (day !== 0) return day;
  const missed = a.missed_at.localeCompare(b.missed_at);
  if (missed !== 0) return missed;
  return a.original_step_id.localeCompare(b.original_step_id);
}
