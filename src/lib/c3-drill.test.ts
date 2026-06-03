import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gradeC3Attempt,
  toPublicItem,
  type C3DrillItem,
} from "./c3-drill.js";

// ---- fixtures ----

function truthCheck(correct: "TRUE" | "NOT_TRUE"): C3DrillItem {
  return {
    id: "L1-D11-I01",
    drill_id: "1.1",
    sequence: 1,
    task_type: "TRUTH_CHECK",
    prompt: "A merchant's signed firm offer is irrevocable without consideration.",
    correct_status: correct,
    skill: "EAR",
    short_explanation: "UCC 2-205 firm offer.",
    say_the_break: "True — merchant firm offer.",
    legal_review_status: "pending",
    source_status: "authored",
    enabled: true,
  };
}

const filterBreak: C3DrillItem = {
  id: "L1-D12-I01",
  drill_id: "1.2",
  sequence: 1,
  task_type: "FILTER_BREAK",
  stem: "Motion to dismiss for failure to serve.",
  prompt: "Classify the wrong answer.",
  choice_text: "Deny: filing commenced the action and it was filed in time.",
  correct_status: "TRUE_BUT_NOT_RESPONSIVE",
  skill: "ISSUE_SENSE",
  short_explanation: "Filing is true law, but the motion is about service.",
  why_tempting: "States a familiar procedural rule.",
  say_the_break: "True, but wrong question.",
  legal_review_status: "pending",
  source_status: "legacy_candidate",
  enabled: true,
};

const trueVsTrue: C3DrillItem = {
  id: "L1-D14-I01",
  drill_id: "1.4",
  sequence: 1,
  task_type: "TRUE_VS_TRUE",
  stem: "Failure-to-serve motion.",
  prompt: "Which answer responds to the call?",
  choices: [
    { id: "A", text: "Filing commenced the action and was timely." },
    { id: "B", text: "No good cause was shown for the failure to serve." },
  ],
  correct_choice_id: "B",
  choice_statuses: { A: "TRUE_BUT_NOT_RESPONSIVE", B: "SURVIVES" },
  skill: "ISSUE_SENSE",
  short_explanation: "The motion is about service, not filing.",
  say_the_break: "A is true, but wrong question. B survives.",
  legal_review_status: "pending",
  source_status: "legacy_candidate",
  enabled: true,
};

const choiceClassification: C3DrillItem = {
  id: "L1-D15-I01",
  drill_id: "1.5",
  sequence: 1,
  task_type: "CHOICE_CLASSIFICATION",
  prompt: "Classify each choice.",
  choices: [
    { id: "A", text: "Appropriation requires using the plaintiff's name." },
    { id: "B", text: "Sufficient indicia of identity support liability." },
  ],
  choice_statuses: { A: "NOT_TRUE", B: "SURVIVES" },
  skill: "CUT",
  short_explanation: "Indicia of identity suffice; no name required.",
  say_the_break: "A is false; B survives.",
  legal_review_status: "pending",
  source_status: "authored",
  enabled: true,
};

// ---- 1. TRUTH_CHECK correct / 2. incorrect ----

test("TRUTH_CHECK: correct when selected status matches", () => {
  const r = gradeC3Attempt(truthCheck("TRUE"), { selected_status: "TRUE" });
  assert.equal(r.correct, true);
  assert.equal(r.missed_filter, null);
  assert.equal(r.missed_skill, null);
  assert.equal(r.explanation.verdict, "TRUE");
});

test("TRUTH_CHECK: incorrect when status mismatches", () => {
  const r = gradeC3Attempt(truthCheck("NOT_TRUE"), { selected_status: "TRUE" });
  assert.equal(r.correct, false);
  assert.equal(r.missed_filter, "NOT_TRUE");
  assert.equal(r.missed_skill, "EAR");
});

// ---- 3. FILTER_BREAK correct for TRUE_BUT_NOT_RESPONSIVE / 4. incorrect ----

test("FILTER_BREAK: correct for TRUE_BUT_NOT_RESPONSIVE", () => {
  const r = gradeC3Attempt(filterBreak, {
    selected_status: "TRUE_BUT_NOT_RESPONSIVE",
  });
  assert.equal(r.correct, true);
  assert.equal(r.explanation.verdict, "TRUE BUT NOT RESPONSIVE");
  assert.equal(r.explanation.say_the_break, "True, but wrong question.");
});

test("FILTER_BREAK: incorrect when student picks NOT_TRUE", () => {
  const r = gradeC3Attempt(filterBreak, { selected_status: "NOT_TRUE" });
  assert.equal(r.correct, false);
  // The student missed that it was true-but-not-responsive → NOT_RESPONSIVE gap.
  assert.equal(r.missed_filter, "NOT_RESPONSIVE");
  assert.equal(r.missed_skill, "ISSUE_SENSE");
});

// ---- 5. TRUE_VS_TRUE correct by choice id ----

test("TRUE_VS_TRUE: correct by choice id", () => {
  const r = gradeC3Attempt(trueVsTrue, { selected_choice_id: "B" });
  assert.equal(r.correct, true);
  assert.equal(r.correct_choice_id, "B");
});

test("TRUE_VS_TRUE: wrong pick derives missed filter from the picked choice", () => {
  const r = gradeC3Attempt(trueVsTrue, { selected_choice_id: "A" });
  assert.equal(r.correct, false);
  // Picked the true-but-not-responsive choice → NOT_RESPONSIVE gap.
  assert.equal(r.missed_filter, "NOT_RESPONSIVE");
});

// ---- 6. CHOICE_CLASSIFICATION requires all statuses to match ----

test("CHOICE_CLASSIFICATION: correct only when every choice matches", () => {
  const ok = gradeC3Attempt(choiceClassification, {
    selected_choice_statuses: { A: "NOT_TRUE", B: "SURVIVES" },
  });
  assert.equal(ok.correct, true);

  const partial = gradeC3Attempt(choiceClassification, {
    selected_choice_statuses: { A: "SURVIVES", B: "SURVIVES" },
  });
  assert.equal(partial.correct, false);

  const missing = gradeC3Attempt(choiceClassification, {
    selected_choice_statuses: { A: "NOT_TRUE" },
  });
  assert.equal(missing.correct, false);
});

// ---- 7. SURVIVOR_PICK requires classifying rejected choices when present ----

test("SURVIVOR_PICK: survivor alone is not enough when choice_statuses exist", () => {
  const item: C3DrillItem = {
    id: "L1-D13-I01",
    drill_id: "1.3",
    sequence: 1,
    task_type: "SURVIVOR_PICK",
    prompt: "Pick the survivor; classify the rest.",
    choices: [
      { id: "A", text: "..." },
      { id: "B", text: "..." },
      { id: "C", text: "..." },
      { id: "D", text: "..." },
    ],
    correct_choice_id: "D",
    choice_statuses: {
      A: "NOT_TRUE",
      B: "NOT_TRUE",
      C: "NOT_TRUE",
      D: "SURVIVES",
    },
    skill: "CALL",
    short_explanation: "A/B/C misstate the rule.",
    say_the_break: "D survives.",
    legal_review_status: "pending",
    source_status: "authored",
    enabled: true,
  };

  const survivorOnly = gradeC3Attempt(item, { selected_choice_id: "D" });
  assert.equal(survivorOnly.correct, false);

  const full = gradeC3Attempt(item, {
    selected_choice_id: "D",
    selected_choice_statuses: {
      A: "NOT_TRUE",
      B: "NOT_TRUE",
      C: "NOT_TRUE",
      D: "SURVIVES",
    },
  });
  assert.equal(full.correct, true);
});

// ---- 8. public item strips the answer key ----

test("toPublicItem drops every answer-bearing field", () => {
  const pub = toPublicItem(trueVsTrue) as Record<string, unknown>;
  assert.equal("correct_choice_id" in pub, false);
  assert.equal("choice_statuses" in pub, false);
  assert.equal("short_explanation" in pub, false);
  assert.equal("say_the_break" in pub, false);
  assert.equal("why_tempting" in pub, false);
  // …but keeps what the student needs to answer.
  assert.equal(pub.prompt, "Which answer responds to the call?");
  assert.ok(Array.isArray(pub.choices));
});
