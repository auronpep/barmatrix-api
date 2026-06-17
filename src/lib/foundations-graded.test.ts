import { test } from "node:test";
import assert from "node:assert/strict";
import { FOUNDATIONS_COURSE } from "./foundations.data.js";

test("content reset keeps foundations lessons text-only with no graded drill items", () => {
  const gradedDrills: string[] = [];
  const gradedItems: string[] = [];
  for (const lesson of FOUNDATIONS_COURSE.lessons) {
    for (const drill of lesson.drills) {
      if (drill.graded_items?.length) gradedDrills.push(`${lesson.slug}:${drill.id}`);
      for (const item of drill.graded_items ?? []) {
        gradedItems.push(item.id);
      }
    }
  }
  assert.equal(FOUNDATIONS_COURSE.lesson_count, 14);
  assert.equal(FOUNDATIONS_COURSE.drill_item_count, 0);
  assert.deepEqual(gradedDrills, []);
  assert.deepEqual(gradedItems, []);
});
