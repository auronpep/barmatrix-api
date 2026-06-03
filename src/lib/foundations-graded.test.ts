// Phase 2 integration: the generated foundations course (build_foundations.py)
// must produce graded items the engine accepts. For every graded item, grading
// the parser-extracted correct answer must return correct:true — this catches any
// parser/engine drift across all converted drills at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOUNDATIONS_COURSE } from "./foundations.data.js";
import { gradeC3Attempt, type C3DrillItem, type C3StudentResponse } from "./c3-drill.js";

function correctResponseFor(item: C3DrillItem): C3StudentResponse {
  switch (item.task_type) {
    case "TRUTH_CHECK":
    case "FILTER_BREAK":
    case "MIXED_CLASSIFICATION":
      return { selected_status: item.correct_status };
    case "CALL_CHECK":
    case "TRUE_VS_TRUE":
    case "SURVIVOR_PICK":
    case "LABEL_SELECT":
      return { selected_choice_id: item.correct_choice_id };
    case "CHOICE_CLASSIFICATION":
      return { selected_choice_statuses: item.choice_statuses };
  }
}

function allGradedItems(): { lesson: number; drill: string; item: C3DrillItem }[] {
  const out: { lesson: number; drill: string; item: C3DrillItem }[] = [];
  for (const lesson of FOUNDATIONS_COURSE.lessons) {
    for (const drill of lesson.drills) {
      for (const item of drill.graded_items ?? []) {
        out.push({ lesson: lesson.number, drill: drill.id, item: item as C3DrillItem });
      }
    }
  }
  return out;
}

test("exactly 20 drills are interactive (Phase 1 + Phase 2)", () => {
  let graded = 0;
  for (const lesson of FOUNDATIONS_COURSE.lessons) {
    for (const drill of lesson.drills) if (drill.graded_items?.length) graded++;
  }
  assert.equal(graded, 20);
});

test("every generated graded item round-trips (engine grades the key as correct)", () => {
  const items = allGradedItems();
  assert.ok(items.length >= 150, `expected many graded items, got ${items.length}`);
  const failures: string[] = [];
  for (const { lesson, drill, item } of items) {
    const r = gradeC3Attempt(item, correctResponseFor(item));
    if (!r.correct) failures.push(`L${lesson} ${drill} ${item.id} (${item.task_type})`);
  }
  assert.deepEqual(failures, [], `items whose key the engine rejects: ${failures.join(", ")}`);
});

test("every graded item carries a legal_review_status (gating intact)", () => {
  for (const { item } of allGradedItems()) {
    assert.ok(["pending", "approved", "needs_revision"].includes(item.legal_review_status));
  }
});
