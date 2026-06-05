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
    case "COUNT_SELECT":
    case "SEQUENCE_SELECT":
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

test("exactly 51 drills are interactive (Phase 1 + 2 + 3 new task types)", () => {
  let graded = 0;
  for (const lesson of FOUNDATIONS_COURSE.lessons) {
    for (const drill of lesson.drills) if (drill.graded_items?.length) graded++;
  }
  // 49 (Phase 1+2) + 2 new-task-type drills (2.2 COUNT_SELECT, 14.1 SEQUENCE_SELECT)
  // — all 51 approved/live (attorney sign-off 2026-06-05).
  assert.equal(graded, 51);
});

test("the 2 new-task-type drills (2.2, 14.1) are approved + live (attorney sign-off 2026-06-05)", () => {
  const byId = new Map<string, { task_type?: string; approved: boolean }>();
  for (const lesson of FOUNDATIONS_COURSE.lessons) {
    for (const drill of lesson.drills) {
      const items = drill.graded_items ?? [];
      if (items.length) {
        byId.set(drill.id, {
          task_type: drill.task_type,
          approved: items.every(
            (it) => (it as C3DrillItem).legal_review_status === "approved",
          ),
        });
      }
    }
  }
  assert.equal(byId.get("2.2")?.task_type, "COUNT_SELECT");
  assert.equal(byId.get("2.2")?.approved, true);
  assert.equal(byId.get("14.1")?.task_type, "SEQUENCE_SELECT");
  assert.equal(byId.get("14.1")?.approved, true);
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
