// J7 Guided "Lead Me" Path — the authored Day-N script (content as code).
//
// Hand-authored (NOT generated), mirroring foundations.data.ts as the content
// source of truth. Only per-student progress/state is stored in the DB; the steps,
// XP, ordering, dependencies, and completion rules live here. Reordering/adding a
// day is a redeploy, not a migration.
//
// FIRST CUT — Day 1 is a lean ~16-step slice that wires all 5 milestone items end
// to end. Expand each day toward the ~50-micro-task target in Phase 4 (founder
// tuning). Microcopy is first-draft pending a barmatrix-context voice pass before
// go-live.
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
  {
    id: "d1.s01",
    day: 1,
    order: 1,
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
    order: 2,
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
  {
    id: "d1.s03",
    day: 1,
    order: 3,
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
  {
    id: "d1.s04",
    day: 1,
    order: 4,
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
    order: 5,
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
  {
    id: "d1.s06",
    day: 1,
    order: 6,
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
    order: 7,
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
  {
    id: "d1.s08",
    day: 1,
    order: 8,
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
    order: 9,
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
    order: 10,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Deck cleared",
    microcopy: "Ten reps in the bank. Recall gets faster every time you run them.",
    xp: 10,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
  },
  {
    id: "d1.s11",
    day: 1,
    order: 11,
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
    order: 12,
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
    order: 13,
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
  {
    id: "d1.s14",
    day: 1,
    order: 14,
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
  {
    id: "d1.s15",
    day: 1,
    order: 15,
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
  {
    id: "d1.s16",
    day: 1,
    order: 16,
    kind: "celebrate",
    is_milestone: false,
    depends_on: [],
    title: "Day 1 complete",
    microcopy:
      "Diagnostic, the Method, the cards, the doctrine, a second pass. That's a full repair loop. Day 2 picks up tomorrow.",
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
