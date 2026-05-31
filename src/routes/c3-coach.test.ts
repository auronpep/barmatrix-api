import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickFromCandidates, buildCoachPayload } from "./c3-coach.js";

describe("pickFromCandidates", () => {
  it("returns the first candidate not in recently-seen", () => {
    assert.equal(pickFromCandidates(["q1", "q2", "q3"], new Set(["q1"])), "q2");
  });
  it("falls back to the first candidate when all are recently seen", () => {
    assert.equal(pickFromCandidates(["q1", "q2"], new Set(["q1", "q2"])), "q1");
  });
  it("returns null when there are no candidates", () => {
    assert.equal(pickFromCandidates([], new Set()), null);
  });
});

describe("buildCoachPayload", () => {
  const question = {
    question_id: "q9", external_id: "TR-1", subject: "TORTS", topic: null, subtopic: null,
    tension_point: null, fact_pattern: "fp", question_stem: "stem", call_of_question: null,
    choices: [{ choice_id: "c1", letter: "A", choice_text: "x" }],
  };
  it("assembles available payload with coaching + remediation", () => {
    const p = buildCoachPayload({
      question,
      mold: { mold_code: "half_truth", name: "Half-truth", family: "EAR_DISTORTION",
              lesson_slug: "lesson-09", deck_ref: "CARD-12", exposures: 11, bite_pct: 62, measured: true },
      deficit: 0.62, coverage: { total_attempts: 40, measured_attempts: 30 },
    });
    assert.equal(p.available, true);
    assert.equal(p.coaching.target_mold, "half_truth");
    assert.equal(p.coaching.deficit_pct, 62);
    assert.equal(p.coaching.measured, true);
    assert.equal(p.remediation.lesson_slug, "lesson-09");
    assert.equal(p.coverage.pct, 75);
    assert.equal(p.cohort_signal, null);
    assert.ok(!("is_correct" in p.question.choices[0]!));
  });
});
