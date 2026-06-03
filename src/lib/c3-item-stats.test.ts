import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pearson,
  computeItemStats,
  liveDifficulty,
  divergence,
  reviewReasonForStats,
  type ItemAttempt,
} from "./c3-item-stats.js";

describe("pearson", () => {
  it("returns null for zero variance or n<2", () => {
    assert.equal(pearson([1], [1]), null);
    assert.equal(pearson([1, 1, 1], [0.2, 0.5, 0.9]), null); // x has no variance
  });
  it("computes a perfect positive correlation", () => {
    const r = pearson([0, 1], [0.1, 0.9]);
    assert.ok(r !== null && Math.abs(r - 1) < 1e-9);
  });
});

describe("computeItemStats", () => {
  it("returns empty stats for no attempts", () => {
    const s = computeItemStats([], "B");
    assert.equal(s.n_attempts, 0);
    assert.equal(s.p_correct, 0);
    assert.equal(s.discrimination, null);
  });

  it("computes p_correct, flag_rate, distractor_pull, mean_time", () => {
    const attempts: ItemAttempt[] = [
      { studentAbility: 0.9, correct: true, selectedLetter: "B", flagged: false, timeMs: 10_000 },
      { studentAbility: 0.3, correct: false, selectedLetter: "A", flagged: true, timeMs: 20_000 },
      { studentAbility: 0.4, correct: false, selectedLetter: "A", flagged: false, timeMs: 30_000 },
      { studentAbility: 0.8, correct: true, selectedLetter: "B", flagged: false, timeMs: null },
    ];
    const s = computeItemStats(attempts, "B");
    assert.equal(s.n_attempts, 4);
    assert.equal(s.p_correct, 0.5);
    assert.equal(s.flag_rate, 0.25);
    // A chosen 2/4 of all attempts
    assert.equal(s.distractor_pull["A"], 0.5);
    assert.equal(s.distractor_pull["B"], undefined); // credited letter excluded
    assert.equal(s.mean_time_ms, 20_000); // (10k+20k+30k)/3
    // higher-ability students got it right -> positive discrimination
    assert.ok(s.discrimination !== null && s.discrimination > 0);
  });
});

describe("liveDifficulty / divergence", () => {
  it("maps p_correct to difficulty bands", () => {
    assert.equal(liveDifficulty(0.95), 1);
    assert.equal(liveDifficulty(0.6), 2);
    assert.equal(liveDifficulty(0.3), 3);
  });
  it("computes divergence as live - prior", () => {
    assert.equal(divergence(3, 1), 2);
    assert.equal(divergence(1, 2), -1);
  });
});

describe("reviewReasonForStats", () => {
  const base = { n_attempts: 40, p_correct: 0.5, discrimination: 0.5, mean_time_ms: 1000, flag_rate: 0.05, distractor_pull: {} };

  it("returns null below MIN_SAMPLE", () => {
    assert.equal(reviewReasonForStats({ ...base, n_attempts: 10, flag_rate: 0.9 }), null);
  });
  it("flags low discrimination first", () => {
    assert.equal(reviewReasonForStats({ ...base, discrimination: 0.05 }), "LOW_DISCRIMINATION");
  });
  it("flags high flag rate", () => {
    assert.equal(reviewReasonForStats({ ...base, flag_rate: 0.3 }), "HIGH_FLAG_RATE");
  });
  it("flags a dominant distractor", () => {
    assert.equal(reviewReasonForStats({ ...base, distractor_pull: { A: 0.6 } }), "DISTRACTOR_PULL");
  });
  it("returns null for a healthy item", () => {
    assert.equal(reviewReasonForStats(base), null);
  });
});
