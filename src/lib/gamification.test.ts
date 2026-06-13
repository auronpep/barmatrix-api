import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStreak,
  dayXp,
  masteryXp,
  evaluateDayContentBadges,
  evaluateStreakBadges,
  evaluateMasteryBadges,
  utcToday,
  BADGE_CATALOG,
} from "./gamification.js";

test("utcToday formats a Date as YYYY-MM-DD in UTC", () => {
  assert.equal(utcToday(new Date("2026-05-30T23:30:00Z")), "2026-05-30");
  assert.equal(utcToday(new Date("2026-01-01T00:00:00Z")), "2026-01-01");
});

test("applyStreak: first activity starts streak at 1", () => {
  const r = applyStreak(null, "2026-05-30", 0, 0);
  assert.deepEqual(r, { current_streak: 1, longest_streak: 1, changed: true });
});

test("applyStreak: same day is a no-op", () => {
  const r = applyStreak("2026-05-30", "2026-05-30", 3, 5);
  assert.deepEqual(r, { current_streak: 3, longest_streak: 5, changed: false });
});

test("applyStreak: consecutive day increments", () => {
  const r = applyStreak("2026-05-29", "2026-05-30", 3, 5);
  assert.deepEqual(r, { current_streak: 4, longest_streak: 5, changed: true });
});

test("applyStreak: consecutive day past longest updates longest", () => {
  const r = applyStreak("2026-05-29", "2026-05-30", 5, 5);
  assert.deepEqual(r, { current_streak: 6, longest_streak: 6, changed: true });
});

test("applyStreak: gap resets to 1, longest preserved", () => {
  const r = applyStreak("2026-05-27", "2026-05-30", 9, 9);
  assert.deepEqual(r, { current_streak: 1, longest_streak: 9, changed: true });
});

test("dayXp: passing day = correct*10 + 50 bonus", () => {
  assert.equal(dayXp(12, false), 170);
  assert.equal(dayXp(9, false), 140);
});

test("dayXp: skipped day earns nothing", () => {
  assert.equal(dayXp(4, true), 0);
});

test("masteryXp: passing adds the 200 bonus", () => {
  assert.equal(masteryXp(20, true), 400);
  assert.equal(masteryXp(20, false), 200);
});

test("evaluateDayContentBadges: first-day always; perfect-day only on all-correct", () => {
  assert.deepEqual(
    evaluateDayContentBadges({ day: 1, dayCount: 5, correct: 10, dayQuestionCount: 12 }),
    ["first-day"],
  );
  assert.deepEqual(
    evaluateDayContentBadges({ day: 3, dayCount: 5, correct: 12, dayQuestionCount: 12 }),
    ["first-day", "halfway", "perfect-day"],
  );
});

test("evaluateDayContentBadges: halfway needs day >= ceil(dayCount/2)", () => {
  assert.deepEqual(
    evaluateDayContentBadges({ day: 2, dayCount: 5, correct: 8, dayQuestionCount: 12 }),
    ["first-day"],
  );
});

test("evaluateStreakBadges: thresholds", () => {
  assert.deepEqual(evaluateStreakBadges(2), []);
  assert.deepEqual(evaluateStreakBadges(3), ["streak-3"]);
  assert.deepEqual(evaluateStreakBadges(7), ["streak-3", "streak-7"]);
});

test("evaluateMasteryBadges: camp-complete on pass, mastery-ace at >=0.9", () => {
  assert.deepEqual(evaluateMasteryBadges({ score: 0.8, mastered: true }), ["camp-complete"]);
  assert.deepEqual(
    evaluateMasteryBadges({ score: 0.92, mastered: true }),
    ["camp-complete", "mastery-ace"],
  );
  assert.deepEqual(evaluateMasteryBadges({ score: 0.5, mastered: false }), []);
});

test("BADGE_CATALOG covers every slug the evaluators can emit", () => {
  for (const slug of [
    "first-day",
    "halfway",
    "perfect-day",
    "camp-complete",
    "mastery-ace",
    "streak-3",
    "streak-7",
    "path-day1-complete",
    "guided-day",
    "catchup-clear",
  ] as const) {
    assert.ok(BADGE_CATALOG[slug], `missing catalog entry for ${slug}`);
  }
});
