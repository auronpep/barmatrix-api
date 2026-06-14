import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  daysToExam,
  EXAM_DATE_ISO,
  SESSION_GOAL_MIN,
  computeStreak,
  shapeSubjectMastery,
  shapeCoverage,
  TENSION_COLS,
  trapSlugToDimension,
  buildTensionMatrix,
} from "./command-deck.js";

describe("shapeCoverage", () => {
  it("computes percent of the active bank attempted", () => {
    assert.deepEqual(shapeCoverage(150, 600), {
      covered: 150,
      bank_total: 600,
      pct: 25,
    });
  });
  it("rounds to the nearest whole percent", () => {
    assert.equal(shapeCoverage(1, 3).pct, 33);
  });
  it("returns 0 percent for an empty bank (no divide-by-zero)", () => {
    assert.deepEqual(shapeCoverage(0, 0), {
      covered: 0,
      bank_total: 0,
      pct: 0,
    });
  });
  it("coerces string/null counts and floors negatives to 0", () => {
    assert.deepEqual(shapeCoverage(-5 as number, 100), {
      covered: 0,
      bank_total: 100,
      pct: 0,
    });
  });
});

describe("daysToExam", () => {
  it("counts whole days from a given 'now' to the exam date (UTC)", () => {
    // EXAM_DATE_ISO is 2026-07-28; from 2026-06-13 that is 45 days.
    assert.equal(daysToExam(new Date("2026-06-13T00:00:00Z")), 45);
  });
  it("returns 0 on exam day", () => {
    assert.equal(daysToExam(new Date("2026-07-28T09:00:00Z")), 0);
  });
  it("returns null once the exam date has passed", () => {
    assert.equal(daysToExam(new Date("2026-07-29T00:00:00Z")), null);
  });
  it("exposes the session goal + exam constants", () => {
    assert.equal(SESSION_GOAL_MIN, 45);
    assert.equal(EXAM_DATE_ISO, "2026-07-28");
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const today = new Date("2026-06-13T12:00:00Z");
    assert.equal(computeStreak(["2026-06-13", "2026-06-12", "2026-06-11"], today), 3);
  });
  it("allows the streak to end yesterday (today not yet practiced)", () => {
    const today = new Date("2026-06-13T12:00:00Z");
    assert.equal(computeStreak(["2026-06-12", "2026-06-11"], today), 2);
  });
  it("breaks the streak on a gap", () => {
    const today = new Date("2026-06-13T12:00:00Z");
    assert.equal(computeStreak(["2026-06-13", "2026-06-11"], today), 1);
  });
  it("returns 0 when the most recent day is older than yesterday", () => {
    const today = new Date("2026-06-13T12:00:00Z");
    assert.equal(computeStreak(["2026-06-10"], today), 0);
  });
  it("returns 0 for no rows", () => {
    assert.equal(computeStreak([], new Date("2026-06-13T12:00:00Z")), 0);
  });
});

describe("shapeSubjectMastery", () => {
  it("computes recent pct and delta vs prior window, sorted by pct asc", () => {
    const rows = [
      { subject: "Torts", att_recent: 10, cor_recent: 8, att_prior: 10, cor_prior: 5 }, // 80, +30
      { subject: "Evidence", att_recent: 20, cor_recent: 10, att_prior: 10, cor_prior: 6 }, // 50, -10
    ];
    const out = shapeSubjectMastery(rows);
    assert.deepEqual(out, [
      { subject: "Evidence", pct: 50, delta: -10, attempted: 20 },
      { subject: "Torts", pct: 80, delta: 30, attempted: 10 },
    ]);
  });
  it("delta is 0 when the prior window is empty", () => {
    const out = shapeSubjectMastery([
      { subject: "Contracts", att_recent: 4, cor_recent: 2, att_prior: 0, cor_prior: 0 },
    ]);
    assert.deepEqual(out, [{ subject: "Contracts", pct: 50, delta: 0, attempted: 4 }]);
  });
  it("drops subjects with no recent attempts", () => {
    const out = shapeSubjectMastery([
      { subject: "ConLaw", att_recent: 0, cor_recent: 0, att_prior: 5, cor_prior: 3 },
    ]);
    assert.deepEqual(out, []);
  });
});

describe("tension matrix", () => {
  it("has the 7 design columns in order", () => {
    assert.deepEqual(TENSION_COLS, [
      "Rule/Excptn",
      "Timing",
      "Party",
      "Scope",
      "Standard",
      "Triggers",
      "Remedy",
    ]);
  });
  it("maps known slugs and falls back to Rule/Excptn", () => {
    assert.equal(trapSlugToDimension("wrong_timing"), "Timing");
    assert.equal(trapSlugToDimension("totally_unknown_slug"), "Rule/Excptn");
  });
  it("buckets miss counts into heat 0-5 and pivots by subject", () => {
    const rows = [
      { subject: "Evidence", trap_slug: "wrong_standard", miss_count: 9 },
      { subject: "Evidence", trap_slug: "wrong_timing", miss_count: 1 },
    ];
    const m = buildTensionMatrix(rows);
    assert.equal(m.cols.length, 7);
    const ev = m.rows.find((r) => r.name === "Evidence");
    assert.ok(ev);
    const standardIdx = TENSION_COLS.indexOf("Standard");
    const timingIdx = TENSION_COLS.indexOf("Timing");
    assert.ok(ev.heat[standardIdx]! >= ev.heat[timingIdx]!); // more misses => more heat
    assert.equal(ev.attempts[standardIdx], 9);
  });
  it("returns empty rows for no data", () => {
    assert.deepEqual(buildTensionMatrix([]).rows, []);
  });
});
