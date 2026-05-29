import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DAY_ADVANCE_RATIO,
  computeMasteryScore,
  evaluateDayCompletion,
  flattenDayQuestionIds,
  isMasteryPassed,
  isMasteryUnlocked,
  nextCurrentDay,
  parseDayParam,
  pinDayQuestions,
  pinMasteryQuestions,
  summarizeDayProgress,
} from "./bootcamps.js";

const ids = (n: number, prefix = "q"): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);

// noUncheckedIndexedAccess: indexing the day map yields string[] | undefined.
const dayOf = (res: { days: Record<string, string[]> }, n: number): string[] =>
  res.days[String(n)] ?? [];

describe("pinDayQuestions", () => {
  it("fills full days with no repeats when the pool is large enough", () => {
    const res = pinDayQuestions(ids(60), 5, 12);
    assert.equal(res.partial, false);
    assert.equal(res.pinnedTotal, 60);
    assert.equal(Object.keys(res.days).length, 5);
    assert.equal(dayOf(res, 1).length, 12);
    assert.equal(dayOf(res, 5).length, 12);
    // No question appears on two days.
    const all = flattenDayQuestionIds(res.days);
    assert.equal(all.length, 60);
    assert.equal(new Set(all).size, 60);
  });

  it("marks partial and shortens later days when the pool is small", () => {
    const res = pinDayQuestions(ids(20), 5, 12);
    assert.equal(res.partial, true);
    assert.equal(res.pinnedTotal, 20);
    assert.equal(dayOf(res, 1).length, 12);
    assert.equal(dayOf(res, 2).length, 8);
    assert.equal(dayOf(res, 3).length, 0);
  });

  it("dedupes the candidate pool before pinning", () => {
    const res = pinDayQuestions(["a", "a", "b", "b", "c"], 2, 2);
    assert.deepEqual(dayOf(res, 1), ["a", "b"]);
    assert.deepEqual(dayOf(res, 2), ["c"]);
    assert.equal(res.partial, true);
  });

  it("handles an empty pool", () => {
    const res = pinDayQuestions([], 3, 12);
    assert.equal(res.pinnedTotal, 0);
    assert.equal(res.partial, true);
    assert.deepEqual(dayOf(res, 1), []);
  });
});

describe("pinMasteryQuestions", () => {
  it("takes up to masteryCount unique ids", () => {
    const res = pinMasteryQuestions(ids(40), 24);
    assert.equal(res.mastery.length, 24);
    assert.equal(res.partial, false);
  });

  it("is partial when the pool is short and dedupes", () => {
    const res = pinMasteryQuestions(["a", "a", "b"], 24);
    assert.deepEqual(res.mastery, ["a", "b"]);
    assert.equal(res.partial, true);
  });
});

describe("computeMasteryScore", () => {
  it("computes the correct ratio", () => {
    assert.equal(computeMasteryScore(18, 24), 0.75);
    assert.equal(computeMasteryScore(24, 24), 1);
  });

  it("returns 0 for a zero or negative total (no NaN)", () => {
    assert.equal(computeMasteryScore(0, 0), 0);
    assert.equal(computeMasteryScore(5, 0), 0);
    assert.equal(computeMasteryScore(3, -2), 0);
  });

  it("clamps out-of-range inputs into [0,1]", () => {
    assert.equal(computeMasteryScore(30, 24), 1);
    assert.equal(computeMasteryScore(-3, 24), 0);
  });
});

describe("isMasteryPassed", () => {
  it("passes at or above threshold", () => {
    assert.equal(isMasteryPassed(0.75, 0.75), true);
    assert.equal(isMasteryPassed(0.8, 0.75), true);
    assert.equal(isMasteryPassed(0.74, 0.75), false);
  });
});

describe("evaluateDayCompletion", () => {
  it("is eligible when every question is answered and the bar is met", () => {
    const r = evaluateDayCompletion({
      correctCount: 9,
      answeredCount: 12,
      dayQuestionCount: 12,
    });
    assert.equal(r.allAnswered, true);
    assert.equal(r.passed, true);
    assert.equal(r.eligibleToAdvance, true);
    assert.equal(r.score, 0.75);
  });

  it("is not eligible when the block is only partly answered", () => {
    const r = evaluateDayCompletion({
      correctCount: 6,
      answeredCount: 6,
      dayQuestionCount: 12,
    });
    assert.equal(r.allAnswered, false);
    assert.equal(r.eligibleToAdvance, false);
  });

  it("is not eligible when all answered but below the bar", () => {
    const r = evaluateDayCompletion({
      correctCount: 7,
      answeredCount: 12,
      dayQuestionCount: 12,
    });
    assert.equal(r.allAnswered, true);
    assert.equal(r.passed, false);
    assert.equal(r.eligibleToAdvance, false);
  });

  it("uses DAY_ADVANCE_RATIO by default", () => {
    assert.equal(DAY_ADVANCE_RATIO, 0.75);
  });
});

describe("nextCurrentDay", () => {
  it("advances exactly one when completing the current day", () => {
    assert.equal(nextCurrentDay(2, 2, 5), 3);
  });

  it("is idempotent when re-completing an earlier day", () => {
    assert.equal(nextCurrentDay(3, 2, 5), 3);
  });

  it("does not advance when completing a future day", () => {
    assert.equal(nextCurrentDay(2, 4, 5), 2);
  });

  it("sets the mastery-unlock sentinel after the last day", () => {
    assert.equal(nextCurrentDay(5, 5, 5), 6);
    assert.equal(isMasteryUnlocked(6, 5), true);
    assert.equal(isMasteryUnlocked(5, 5), false);
  });
});

describe("summarizeDayProgress", () => {
  it("derives status and per-day counts", () => {
    const days = { "1": ["a", "b"], "2": ["c", "d"], "3": ["e"] };
    const answered = new Map<string, boolean>([
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
    const progress = summarizeDayProgress(days, 2, answered);
    assert.equal(progress.length, 3);

    assert.deepEqual(progress[0], {
      day: 1,
      status: "complete",
      total: 2,
      answered: 2,
      correct: 1,
    });
    assert.deepEqual(progress[1], {
      day: 2,
      status: "current",
      total: 2,
      answered: 1,
      correct: 1,
    });
    assert.deepEqual(progress[2], {
      day: 3,
      status: "locked",
      total: 1,
      answered: 0,
      correct: 0,
    });
  });
});

describe("parseDayParam", () => {
  it("accepts an in-range day", () => {
    assert.equal(parseDayParam("3", 5), 3);
    assert.equal(parseDayParam(1, 5), 1);
  });

  it("rejects out-of-range or non-numeric values", () => {
    assert.equal(parseDayParam("0", 5), null);
    assert.equal(parseDayParam("6", 5), null);
    assert.equal(parseDayParam("abc", 5), null);
    assert.equal(parseDayParam(undefined, 5), null);
    assert.equal(parseDayParam("2.5", 5), 2); // parseInt truncates; 2 is in range
  });
});

describe("flattenDayQuestionIds", () => {
  it("flattens in day order and dedupes", () => {
    const flat = flattenDayQuestionIds({ "1": ["a", "b"], "2": ["b", "c"] });
    assert.deepEqual(flat, ["a", "b", "c"]);
  });
});
