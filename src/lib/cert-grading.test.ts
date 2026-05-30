// barmatrix-api/src/lib/cert-grading.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CertKeyCompetency } from "./cert.js";
const { gradeCompetency } = await import("./cert-grading.js");

const single: CertKeyCompetency = {
  capture: "single", pass: { type: "min_correct", n: 2, of: 3 }, remediation_lessons: ["lesson-01"],
  items: [
    { id: "X-1", key: "A", explanation: "a" },
    { id: "X-2", key: "B", explanation: "b" },
    { id: "X-3", key: "C", explanation: "c" },
  ],
};
const band: CertKeyCompetency = {
  capture: "band", pass: { type: "calibration", band_match_min: 2, of: 3, no_undercalled_cut: true },
  remediation_lessons: [],
  items: [
    { id: "B-1", key_band: "HIGH", is_clean_or_anchor: true },
    { id: "B-2", key_band: "MED", is_clean_or_anchor: false },
    { id: "B-3", key_band: "COIN", is_clean_or_anchor: false },
  ],
};
const integ: CertKeyCompetency = {
  capture: "integration", pass: { type: "integration", accuracy: { n: 2, of: 3 }, phase_min: 2, of: 4 },
  remediation_lessons: [],
  items: [
    { id: "I-1", key_answer: "A", key_phase: "CUT", is_deterministic: true, is_fork: false },
    { id: "I-2", key_answer: "B", key_phase: "CLASH", is_deterministic: true, is_fork: false },
    { id: "I-3", key_answer: "C", key_phase: "CALL", is_deterministic: true, is_fork: false },
    { id: "I-4", key_answer: "D", key_phase: "CLASH", is_deterministic: false, is_fork: true },
  ],
};

describe("gradeCompetency single", () => {
  it("passes at threshold and reports per-item", () => {
    const r = gradeCompetency(single, [{ id: "X-1", value: "A" }, { id: "X-2", value: "B" }, { id: "X-3", value: "Z" }]);
    assert.equal(r.score, 2); assert.equal(r.passed, true);
    assert.equal(r.per_item.find((p) => p.id === "X-3")!.correct, false);
  });
});
describe("gradeCompetency band (calibration)", () => {
  it("fails when a clean/anchor item is under-called below HIGH even if band_match_min met", () => {
    const r = gradeCompetency(band, [{ id: "B-1", band: "MED" }, { id: "B-2", band: "MED" }, { id: "B-3", band: "COIN" }]);
    assert.equal(r.calibration_passed, false); // B-1 is clean/anchor but called MED
    assert.equal(r.passed, false);
  });
  it("passes when bands match and no under-called cut", () => {
    const r = gradeCompetency(band, [{ id: "B-1", band: "HIGH" }, { id: "B-2", band: "MED" }, { id: "B-3", band: "HIGH" }]);
    assert.equal(r.score, 2); assert.equal(r.passed, true);
  });
});
describe("gradeCompetency integration", () => {
  it("requires accuracy + all forks flagged + phase", () => {
    const ok = gradeCompetency(integ, [
      { id: "I-1", value: "A", phase: "CUT", flag: false },
      { id: "I-2", value: "B", phase: "CLASH", flag: false },
      { id: "I-3", value: "Z", phase: "CALL", flag: false },
      { id: "I-4", value: "D", phase: "CLASH", flag: true },
    ]);
    assert.equal(ok.accuracy_score, 2); assert.equal(ok.forks_passed, true);
    assert.equal(ok.phase_score, 4); assert.equal(ok.passed, true);
    const noFlag = gradeCompetency(integ, [
      { id: "I-1", value: "A", phase: "CUT", flag: false },
      { id: "I-2", value: "B", phase: "CLASH", flag: false },
      { id: "I-3", value: "C", phase: "CALL", flag: false },
      { id: "I-4", value: "D", phase: "CLASH", flag: false },
    ]);
    assert.equal(noFlag.forks_passed, false); assert.equal(noFlag.passed, false);
  });
});
