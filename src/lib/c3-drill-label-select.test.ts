// Phase 2: LABEL_SELECT task type — pick the correct label from a fixed set
// (e.g. Rule/Standard, Ear/Issue-Sense, name-the-mold). Grades by choice-id match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeC3Attempt, toPublicItem, type C3DrillItem } from "./c3-drill.js";

const labelSelect: C3DrillItem = {
  id: "L4-D42-I01",
  drill_id: "4.2",
  sequence: 1,
  task_type: "LABEL_SELECT",
  prompt: '"A repudiation can never be retracted once communicated."',
  choices: [
    { id: "TIERED-ABSOLUTE", text: "TIERED-ABSOLUTE" },
    { id: "FABRICATED RULE", text: "FABRICATED RULE" },
    { id: "EXTREME-OF-RANGE", text: "EXTREME-OF-RANGE" },
  ],
  correct_choice_id: "TIERED-ABSOLUTE",
  skill: "EAR",
  short_explanation: '"never"; retractable until relied on.',
  say_the_break: "TIERED-ABSOLUTE — \"never\"",
  legal_review_status: "pending",
  source_status: "legacy_candidate",
  enabled: true,
};

test("LABEL_SELECT: correct label is graded correct", () => {
  const r = gradeC3Attempt(labelSelect, { selected_choice_id: "TIERED-ABSOLUTE" });
  assert.equal(r.correct, true);
  assert.equal(r.correct_choice_id, "TIERED-ABSOLUTE");
  // A label miss is not a filter break — the review signal is the skill.
  assert.equal(r.missed_filter, null);
});

test("LABEL_SELECT: wrong label is graded incorrect, skill carried", () => {
  const r = gradeC3Attempt(labelSelect, { selected_choice_id: "FABRICATED RULE" });
  assert.equal(r.correct, false);
  assert.equal(r.correct_choice_id, undefined);
  assert.equal(r.missed_filter, null);
  assert.equal(r.missed_skill, "EAR");
});

test("LABEL_SELECT: verdict line names the correct label", () => {
  const r = gradeC3Attempt(labelSelect, { selected_choice_id: "EXTREME-OF-RANGE" });
  assert.match(r.explanation.verdict, /Correct label: TIERED-ABSOLUTE/);
});

test("LABEL_SELECT: public item ships the labels but strips the key", () => {
  const pub = toPublicItem(labelSelect) as Record<string, unknown>;
  assert.ok(Array.isArray(pub.choices)); // labels visible so the UI can render buttons
  assert.equal("correct_choice_id" in pub, false); // answer stripped pre-submission
  assert.equal("short_explanation" in pub, false);
});
