// J7 Guided "Lead Me" Path — the authored Day-N script (content as code).
//
// Hand-authored (NOT generated), mirroring foundations.data.ts as the content
// source of truth. Only per-student progress/state is stored in the DB; the steps,
// XP, ordering, dependencies, and completion rules live here. Reordering/adding a
// day is a redeploy, not a migration.
//
// Orders use 10-spacing so new steps can be inserted without a full renumber.
// 50 steps authored (Day 1 complete). Microcopy is first-draft pending a
// barmatrix-context voice pass before go-live.
//
// TASK TAXONOMY (5 micro-task types):
//   micro_read    — short inline rule read; student taps "Got it →"
//   reflect       — rule recall prompt; student answers mentally, taps "Got it →"
//   mini_drill    — 3-5 question interactive drill served from /api/study/mini-drill/:id
//                   sub-types: charge_picker (fact → charge) | trap_spotter (find the wrong answer)
//   quiz_set      — curated question-bank set (attorney-gated milestones)
//   celebrate     — milestone celebration; student taps "Keep going →"
//   (foundations_lesson, flashcard_deck, doctrinal_lesson — live milestone items)
//
// Gating: items 1, 4, 5 are attorney_gated. Quiz sets carry empty question_ids
// until the founder delivers the hand-picked IDs (the engine treats an empty quiz
// set as unavailable and serves the path around it). The doctrinal lesson is
// unavailable until DOCTRINAL_APPROVED=1.

import type { PathStep } from "./path-engine.js";

export const PATH_VERSION = 1;

// Stable, fixed UUIDs for the two curated Criminal sets. The app posts attempts
// with these exact set_ids; completion is COUNT(DISTINCT question_id) for the
// set_id. Fixed UUIDs (not human labels) so they pass the attempts route's
// UUID check and are stored verbatim in student_attempts.set_id (CHAR(36)).
export const CRIMINAL_SET_1_ID = "0d1c0001-0000-4000-8000-000000000001";
export const CRIMINAL_SET_2_ID = "0d1c0002-0000-4000-8000-000000000002";

export const CRIMINAL_DAY1_DECK_ID = "criminal-law-day1";
export const CRIMINAL_DOCTRINAL_SLUG = "criminal-law-day1";

// The curated-set target size. The route clamps each quiz step's required count to
// the number of question_ids actually loaded, so a short founder pick can't make a
// set permanently un-completable.
const CURATED_SET_SIZE = 10;

export const PATH_STEPS: PathStep[] = [
  // ─── Welcome ────────────────────────────────────────────────────────────
  {
    id: "d1.s01",
    day: 1,
    order: 10,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Welcome — here's how this works",
    microcopy:
      "One task at a time. We tell you the next move; you make it. No menus, no guessing what to study.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s02",
    day: 1,
    order: 20,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "What BarMatrix actually fixes",
    microcopy:
      "You don't need more questions. You need to stop falling for the same engineered wrong answers. That's the whole game.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Pre-Quiz Warmup: Homicide Malice Quartet ───────────────────────────
  {
    id: "d1.s17",
    day: 1,
    order: 30,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "The 4 roads to murder",
    microcopy:
      "Murder doesn't require intent to kill. Malice = ANY ONE of: (1) intent to kill, (2) intent to cause serious bodily harm, (3) depraved heart — conscious disregard of extreme risk, (4) felony murder during a BARRK felony. One theory is enough.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s18",
    day: 1,
    order: 40,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Recall the malice quartet",
    microcopy:
      "Without looking — name all four types of malice aforethought. Say them out loud or write them down. Ready when you've got them.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s19",
    day: 1,
    order: 50,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Homicide degree drill — 4 scenarios",
    microcopy:
      "Four fact patterns. Pick the most serious provable charge for each. The degree tree in action.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-homicide-degree" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s20",
    day: 1,
    order: 60,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "The depraved heart line — memorize this",
    microcopy:
      "Conscious disregard of a high risk to human life = depraved heart = MURDER (2nd degree). Criminal negligence without conscious disregard = involuntary manslaughter. These are not the same. The MBE tests this distinction constantly.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Milestone 1: Criminal Quiz Set #1 ──────────────────────────────────
  {
    id: "d1.s03",
    day: 1,
    order: 70,
    kind: "quiz_set",
    is_milestone: true,
    depends_on: [],
    title: "Criminal Law — cold read, Set 1",
    microcopy:
      "Go cold. A hand-picked Criminal set so we can see exactly which traps pull you.",
    xp: 40,
    attorney_gated: true,
    target: { kind: "quiz", set_id: CRIMINAL_SET_1_ID, question_ids: [] },
    completion_rule: {
      kind: "quiz_attempts_count",
      set_id: CRIMINAL_SET_1_ID,
      required: CURATED_SET_SIZE,
    },
  },

  // ─── Post-Quiz 1: Trap Awareness ────────────────────────────────────────
  {
    id: "d1.s21",
    day: 1,
    order: 80,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Trap spotter: homicide edition — 3 traps",
    microcopy:
      "Three scenarios. One answer choice in each is a classic MBE trap. Identify it and learn the rule that kills it.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-trap-spotter-homicide" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s22",
    day: 1,
    order: 90,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Felony murder: the BARRK crimes",
    microcopy:
      "Felony murder = unintended killing during a BARRK felony (Burglary, Arson, Rape, Robbery, Kidnapping). Key trap: assault with a deadly weapon MERGES into the homicide — it cannot be the predicate felony. Only independent felonies qualify.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s04",
    day: 1,
    order: 100,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Why we start with a cold quiz",
    microcopy:
      "Your misses are the data. Each wrong answer names a tension point we'll repair on purpose.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s05",
    day: 1,
    order: 110,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Name the question that felt worst",
    microcopy:
      "Ten seconds: which one made you second-guess? That instinct is what we sharpen.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Milestone 2: Foundations / The Method ──────────────────────────────
  {
    id: "d1.s06",
    day: 1,
    order: 120,
    kind: "foundations_lesson",
    is_milestone: true,
    depends_on: [],
    title: "The Method — Lesson 1",
    microcopy:
      "The one frame the whole platform runs on: the credited answer is TRUE and RESPONSIVE. Learn it once.",
    xp: 30,
    target: { kind: "route", href: "/foundations/lesson-01?from=path" },
    completion_rule: {
      kind: "foundations_lesson_complete",
      lesson_slug: "lesson-01",
    },
  },
  {
    id: "d1.s07",
    day: 1,
    order: 130,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Lesson 1 down",
    microcopy:
      "You now have the frame. Every drill from here is a rep on cutting not-true and not-responsive answers.",
    xp: 10,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Milestone 3: Flashcards ─────────────────────────────────────────────
  {
    id: "d1.s08",
    day: 1,
    order: 140,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Flashcards are recall reps, not memorization",
    microcopy:
      "Ten fast cards. You're not cramming — you're making the black-letter automatic so it's there under time pressure.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s09",
    day: 1,
    order: 150,
    kind: "flashcard_deck",
    is_milestone: true,
    depends_on: [],
    title: "Criminal Law — 10 rapid cards",
    microcopy:
      "Homicide core: malice, manslaughter, the provocation trap. Flip all ten.",
    xp: 30,
    target: { kind: "flashcard", deck_id: CRIMINAL_DAY1_DECK_ID },
    completion_rule: {
      kind: "flashcard_deck_reviewed",
      deck_id: CRIMINAL_DAY1_DECK_ID,
      required: 10,
    },
  },
  {
    id: "d1.s10",
    day: 1,
    order: 160,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Deck cleared",
    microcopy: "Ten reps in the bank. Recall gets faster every time you run them.",
    xp: 10,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Post-Flashcards: Provocation Mastery ───────────────────────────────
  {
    id: "d1.s23",
    day: 1,
    order: 170,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Murder or voluntary manslaughter? — 3 scenarios",
    microcopy:
      "Three fact patterns involving killings during or after provocation. The four provocation requirements in practice.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-voluntary-manslaughter" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s24",
    day: 1,
    order: 180,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "State the 4 provocation requirements",
    microcopy:
      "Say the four elements that convert murder to voluntary manslaughter. Focus on the one that fails most: cooling time.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Milestone 4: Doctrinal Lesson ──────────────────────────────────────
  {
    id: "d1.s11",
    day: 1,
    order: 190,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "How to read the Criminal Law primer",
    microcopy:
      "Read it for the decision points, not the prose. Where does murder become manslaughter? That's the seam the MBE tests.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s12",
    day: 1,
    order: 200,
    kind: "doctrinal_lesson",
    is_milestone: true,
    depends_on: [],
    title: "Criminal Law — homicide, fast",
    microcopy:
      "The malice quartet, the degree tree, and the provocation trap on one page. The doctrine behind the drills.",
    xp: 25,
    attorney_gated: true,
    target: { kind: "doctrinal", slug: CRIMINAL_DOCTRINAL_SLUG },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s13",
    day: 1,
    order: 210,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "One trap you can now name",
    microcopy:
      "Say it in your own words: the cooling-time trap. Naming it is how you stop falling for it.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Pre-Quiz 2: Causation + Answer Intelligence ─────────────────────────
  {
    id: "d1.s25",
    day: 1,
    order: 220,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Causation: what breaks the chain",
    microcopy:
      "Victim refuses medical care → DOES NOT break chain. Third-party negligence → DOES NOT break chain. Foreseeable consequences stay on the defendant. Suicide after defendant's acts → usually DOES break chain (not foreseeable). Keep asking: was this a foreseeable result?",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s26",
    day: 1,
    order: 230,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Answer intelligence — 4 eliminate-on-sight choices",
    microcopy:
      "Four answer choices the MBE puts in front of you. These are almost always wrong. Learn to spot and kill them on contact.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-answer-intelligence" },
    completion_rule: { kind: "self_declared" },
  },
  // ─── Inchoate Crimes: Attempt ───────────────────────────────────────────
  {
    id: "d1.s27",
    day: 1,
    order: 270,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Attempt: the 4-part formula",
    microcopy:
      "Attempt = (1) specific intent to commit the target crime + (2) substantial step beyond preparation. Two rules you must know cold: FACTUAL impossibility — gun out of range, victim not actually scared — is NEVER a defense. LEGAL impossibility — what you intended would not be a crime even if completed — IS a defense. (Q#639: burning your own building = legal impossibility.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s28",
    day: 1,
    order: 280,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Can you attempt a strict liability crime?",
    microcopy:
      "Think through it: the completed crime needs no intent — so does the attempt? (Answer: yes, attempt ALWAYS requires specific intent, even if the underlying crime is strict liability. Q#700 — 47% wrong.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s29",
    day: 1,
    order: 290,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Attempt traps — 4 scenarios",
    microcopy:
      "Factual impossibility, strict liability + attempt, the compliance-reason test, and legal impossibility. The four most-missed attempt patterns.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-attempt-traps" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Inchoate Crimes: Conspiracy ─────────────────────────────────────────
  {
    id: "d1.s30",
    day: 1,
    order: 300,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Conspiracy: common law vs. MPC — the divide",
    microcopy:
      "Common law = BILATERAL agreement required. Both parties must genuinely intend to agree. Undercover officer → no real intent → NO conspiracy. MPC = UNILATERAL. YOUR genuine agreement is enough. Undercover officer → YES conspiracy. Conspiracy NEVER merges into the completed crime — you can be convicted of both.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s31",
    day: 1,
    order: 310,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Common law + undercover officer = ?",
    microcopy:
      "Say the rule out loud: if the question says 'common law jurisdiction' and the other party is an undercover officer — is there a conspiracy? (Answer: NO. Bilateral agreement required. The officer had no real intent.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s32",
    day: 1,
    order: 320,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Conspiracy: CL vs. MPC — 4 scenarios",
    microcopy:
      "Four conspiracy problems. The jurisdiction changes everything: bilateral vs. unilateral, undercover officers, diplomatic immunity, and protected class members.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-conspiracy-traps" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Theft Crimes ─────────────────────────────────────────────────────────
  {
    id: "d1.s33",
    day: 1,
    order: 330,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "The 5 theft crimes — one grid",
    microcopy:
      "Larceny = trespassory taking, no consent. Larceny by trick = consent to POSSESSION through fraud. False pretenses = consent to TITLE through fraud about a past/present fact (future promise ≠ false pretenses). Embezzlement = lawfully had possession, then converted. Robbery = larceny + force/intimidation from person. Borrowed money + failure to repay = civil debt, not a crime.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s34",
    day: 1,
    order: 340,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Theft crime classification — 4 scenarios",
    microcopy:
      "Larceny by trick vs. false pretenses vs. embezzlement vs. no crime. The possession-vs-title line and the future-promise trap.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-theft-classification" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s35",
    day: 1,
    order: 350,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Burglary: 4 traps the MBE loves",
    microcopy:
      "Trap 1: Vacant/abandoned = NOT a common law dwelling = no burglary. Trap 2: Lawful entry (business hours, open door) = no breaking = no burglary. Trap 3: Intent must exist AT the moment of entry. Trap 4: 'Only burglary' is almost always wrong — if the underlying felony wasn't completed, add attempted larceny.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s36",
    day: 1,
    order: 360,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Burglary in a vacant building — what's the answer?",
    microcopy:
      "Common law jurisdiction. Defendant broke into a building vacant for 3 months. Burglary or no burglary? (Answer: NO burglary at common law — vacant = not a dwelling. Might be attempted larceny but not burglary.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s37",
    day: 1,
    order: 370,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Burglary traps — 3 scenarios",
    microcopy:
      "Vacant building, lawful entry, and the 'only burglary' verdict. The three traps tested most on the MBE.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-burglary-traps" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Accomplice & Accessory ───────────────────────────────────────────────
  {
    id: "d1.s38",
    day: 1,
    order: 380,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Accomplice liability: PURPOSE, not presence",
    microcopy:
      "Two elements required: (1) assistance or encouragement + (2) PURPOSE that the crime be committed. Mere presence — even knowing presence — is NEVER enough. Gang members who watch a murder are not accomplices. For accessory after the fact: passive silence = no crime; active concealment (lying to police, harboring, hiding) = crime. Principal need NOT be convicted first.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s39",
    day: 1,
    order: 390,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Accomplice traps — 3 scenarios",
    microcopy:
      "Mere presence, accessory timing, and foreseeable co-conspirator crimes. Three of the most commonly wrong accomplice answers.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-accomplice-traps" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s40",
    day: 1,
    order: 400,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Bystander vs. accessory after the fact",
    microcopy:
      "Someone witnesses a crime and stays silent — that's usually fine (no duty to report). Someone witnesses a crime and THEN lies to police to protect the offender — that's accessory after the fact. The MBE always hides a lie in the facts. Find the lie.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Defenses ────────────────────────────────────────────────────────────
  {
    id: "d1.s41",
    day: 1,
    order: 410,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Defenses quick reference",
    microcopy:
      "Self-defense: objective reasonable belief; initial aggressor can't claim it. Intoxication: majority = specific intent crimes only; NEVER recklessness (sober objective standard). Duress: NEVER intentional murder — no exception. Mistake of fact: specific intent (even unreasonable); general intent (reasonable only); strict liability (never). Attorney advice = mistake of LAW = almost never a defense.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s42",
    day: 1,
    order: 420,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Two defenses that NEVER work for intentional murder",
    microcopy:
      "Name them. (Answer: duress and necessity — both are absolute bars to intentional murder. No exception, any jurisdiction. Q#624: 26% got it wrong by choosing duress.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s43",
    day: 1,
    order: 430,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Defense scenarios — 4 cases",
    microcopy:
      "Intoxication and murder degrees, strict liability mistake of fact, duress and murder, and attorney advice as a defense. Four defense applications from real MBE questions.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-defenses-scenarios" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s44",
    day: 1,
    order: 440,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Intoxication traps — 3 scenarios",
    microcopy:
      "Three ways the intoxication defense goes wrong: recklessness (never applies), MPC knowingly (does apply), and malice crimes (never applies).",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-intoxication-traps" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s45",
    day: 1,
    order: 450,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Inchoate through Defenses cleared",
    microcopy:
      "Attempt, conspiracy, theft crimes, accomplice liability, and defenses — all covered. Two sections left: merger and the final answer intelligence sweep.",
    xp: 10,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Merger Doctrine ──────────────────────────────────────────────────────
  {
    id: "d1.s46",
    day: 1,
    order: 460,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Merger: the one exception everyone forgets",
    microcopy:
      "Merges: battery → robbery; larceny → robbery; attempt → completed crime; solicitation → completed crime; assault with deadly weapon → homicide (can't be felony murder predicate). Does NOT merge: CONSPIRACY. Conspiracy never merges into the completed crime. You can be convicted of conspiracy AND the target crime. This is the most tested merger rule on the MBE.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s47",
    day: 1,
    order: 470,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Merger traps — 4 scenarios",
    microcopy:
      "Robbery + battery, felony murder + assault merger, conspiracy never merging, and the burglary + attempted larceny package deal. The four merger issues the MBE returns to constantly.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-merger-traps" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s48",
    day: 1,
    order: 480,
    kind: "reflect",
    is_milestone: false,
    depends_on: [],
    title: "Conspiracy + completed crime: one conviction or two?",
    microcopy:
      "Say it explicitly: if a defendant is convicted of both conspiracy to commit robbery AND the completed robbery, does one merge into the other? (Answer: NO. Conspiracy never merges. Two separate convictions stand.)",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Final Answer Intelligence Sweep ──────────────────────────────────────
  {
    id: "d1.s49",
    day: 1,
    order: 490,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Answer intelligence: 5 eliminate-on-sight patterns",
    microcopy:
      "Before reading explanations, eliminate these: (1) 'Not guilty — no intent to kill' on a murder charge. (2) 'Duress/necessity' defense to intentional murder. (3) 'Involuntary manslaughter' when facts show conscious disregard. (4) 'Robbery AND battery' — battery merges. (5) 'Principal must be convicted first' — accessory liability is independent. See these → eliminate → move on.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s50",
    day: 1,
    order: 500,
    kind: "mini_drill",
    is_milestone: false,
    depends_on: [],
    title: "Final answer intelligence sweep — 4 scenarios",
    microcopy:
      "Four more eliminate-on-sight patterns. Identify the trap answer in each and commit it to memory.",
    xp: 15,
    target: { kind: "mini_drill", drill_id: "d1-final-answer-intelligence" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Pre-Quiz 2 Setup ────────────────────────────────────────────────────
  {
    id: "d1.s14",
    day: 1,
    order: 510,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: "Second pass — what changed",
    microcopy:
      "Same subject, new set. Watch how the frame and the cards change what you notice in the facts.",
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },

  // ─── Milestone 5: Criminal Quiz Set #2 ──────────────────────────────────
  {
    id: "d1.s15",
    day: 1,
    order: 520,
    kind: "quiz_set",
    is_milestone: true,
    depends_on: [],
    title: "Criminal Law — cold read, Set 2",
    microcopy:
      "Second hand-picked set. Now you have the frame, the cards, and the doctrine — read the facts for the trap.",
    xp: 40,
    attorney_gated: true,
    target: { kind: "quiz", set_id: CRIMINAL_SET_2_ID, question_ids: [] },
    completion_rule: {
      kind: "quiz_attempts_count",
      set_id: CRIMINAL_SET_2_ID,
      required: CURATED_SET_SIZE,
    },
  },

  // ─── Day Complete ─────────────────────────────────────────────────────────
  {
    id: "d1.s16",
    day: 1,
    order: 530,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Day 1 complete",
    microcopy:
      "Diagnostic, the Method, the cards, the doctrine, a second pass — and the full Criminal Law sweep. That's a complete repair loop. Day 2 picks up tomorrow.",
    xp: 20,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
];

export const PATH_DAY_COUNT = PATH_STEPS.reduce(
  (max, s) => Math.max(max, s.day),
  1,
);

export function getPathStepById(stepId: string): PathStep | null {
  return PATH_STEPS.find((s) => s.id === stepId) ?? null;
}
