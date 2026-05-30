// barmatrix-api/src/lib/c3-scoring.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
const {
  MOLD_FLOOR, moldProficiency, rollupFamilies, overallReadiness, calibrationError,
} = await import("./c3-scoring.js");

describe("moldProficiency", () => {
  it("is not_yet_measured below the exposure floor", () => {
    const p = moldProficiency({ exposures: 5, bites: 1, w_exposure: 7, w_bite: 1 });
    assert.equal(p.measured, false);
    assert.equal(MOLD_FLOOR, 8);
  });
  it("uses difficulty-weighted bite rate when measured", () => {
    // 10 exposures, weighted exposure 20, weighted bite 4 -> proficiency 1 - 0.2 = 0.8
    const p = moldProficiency({ exposures: 10, bites: 3, w_exposure: 20, w_bite: 4 });
    assert.equal(p.measured, true);
    assert.equal(p.proficiency, 0.8);
  });
});

describe("rollupFamilies", () => {
  it("weights molds by exam weight within a family and skips unmeasured", () => {
    const fams = rollupFamilies([
      { mold_code: "bait_doctrine", family: "ISSUE_SENSE", weight: 0.12, exposures: 10, bites: 2, w_exposure: 20, w_bite: 4 },
      { mold_code: "misfit", family: "ISSUE_SENSE", weight: 0.10, exposures: 3, bites: 3, w_exposure: 3, w_bite: 3 }, // unmeasured
    ]);
    const is = fams.find((f) => f.family === "ISSUE_SENSE")!;
    assert.equal(is.measured_molds, 1);
    assert.equal(is.proficiency, 0.8); // only bait_doctrine counts
  });
});

describe("overallReadiness", () => {
  it("is null when nothing is measured", () => {
    assert.equal(overallReadiness([]), null);
  });
  it("is the exam-weighted average of measured family proficiencies (accuracy only)", () => {
    const score = overallReadiness([
      { family: "EAR_OVERCLAIM", proficiency: 0.9, weight: 0.23, measured_molds: 2 },
      { family: "ISSUE_SENSE", proficiency: 0.7, weight: 0.34, measured_molds: 2 },
    ]);
    // (0.9*0.23 + 0.7*0.34) / (0.23+0.34) = (0.207+0.238)/0.57 ≈ 0.781 -> 78
    assert.equal(score, 78);
  });
});

describe("calibrationError", () => {
  it("compares stated confidence band to realized accuracy and flags direction", () => {
    const c = calibrationError([
      { confidence: 5, actual: 0.7, n: 20 }, // stated high (~0.90), actual 0.70 -> overconfident
      { confidence: 3, actual: 0.72, n: 20 },
    ]);
    assert.ok(c.error > 0);
    assert.equal(c.direction, "overconfident");
  });
});
