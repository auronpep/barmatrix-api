// barmatrix-api/src/lib/c3-queries.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
const { moldStatsQuery, phaseAccuracyQuery, calibrationQuery, coverageQuery, ANNOTATED } =
  await import("./c3-queries.js");

describe("c3 query builders", () => {
  it("mold stats: counts exposures on any choice carrying the mold, bites on the picked choice", () => {
    const q = moldStatsQuery();
    assert.ok(q.includes("FROM student_attempts a"));
    assert.ok(q.includes("c3_mold_code IS NOT NULL"));     // exposure set = molds present in the question
    assert.ok(q.includes("sel.letter = a.selected_letter")); // bite = mold of the picked choice
    assert.ok(q.includes(ANNOTATED));                      // only PASS/FORK_OR_SPLIT questions
    assert.ok(q.includes("$1"));                           // student_id param
  });
  it("phase accuracy filters to annotated questions and groups by phase", () => {
    const q = phaseAccuracyQuery();
    assert.ok(q.includes("deciding_phase") && q.includes("GROUP BY"));
    assert.ok(q.includes(ANNOTATED));
  });
  it("calibration groups by confidence 1-5", () => {
    assert.ok(calibrationQuery().includes("a.confidence"));
  });
  it("coverage reports measured vs total attempts", () => {
    const q = coverageQuery();
    assert.ok(q.includes("COUNT(*)") && q.includes("student_attempts"));
  });
});
