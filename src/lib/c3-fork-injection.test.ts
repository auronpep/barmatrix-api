import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  forkPhaseForProgress,
  forkShareForProgress,
  shouldInjectFork,
} from "./c3-fork-injection.js";

describe("forkPhaseForProgress", () => {
  it("ramps share with course progress", () => {
    assert.equal(forkPhaseForProgress(0).name, "early");
    assert.equal(forkPhaseForProgress(49).name, "early");
    assert.equal(forkPhaseForProgress(50).name, "mid");
    assert.equal(forkPhaseForProgress(149).name, "mid");
    assert.equal(forkPhaseForProgress(150).name, "late");
    assert.equal(forkPhaseForProgress(299).name, "late");
    assert.equal(forkPhaseForProgress(300).name, "integration");
    assert.equal(forkPhaseForProgress(10_000).name, "integration");
  });

  it("treats negative / non-finite input as zero progress (early)", () => {
    assert.equal(forkPhaseForProgress(-5).name, "early");
    assert.equal(forkPhaseForProgress(Number.NaN).name, "early");
  });
});

describe("forkShareForProgress", () => {
  it("returns the band midpoints", () => {
    assert.equal(forkShareForProgress(0), 0.075);
    assert.equal(forkShareForProgress(100), 0.125);
    assert.equal(forkShareForProgress(200), 0.2);
    assert.equal(forkShareForProgress(500), 0.2);
  });
});

describe("shouldInjectFork", () => {
  it("injects when the rng draw is below the share", () => {
    // early share = 0.075
    assert.equal(shouldInjectFork(0, () => 0.0), true);
    assert.equal(shouldInjectFork(0, () => 0.074), true);
  });

  it("does not inject when the rng draw is at/above the share", () => {
    assert.equal(shouldInjectFork(0, () => 0.075), false);
    assert.equal(shouldInjectFork(0, () => 0.9), false);
  });

  it("converges to the target share over many draws", () => {
    // Deterministic uniform sweep across [0,1): empirical rate must equal share.
    const N = 10_000;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      const r = i / N;
      if (shouldInjectFork(200, () => r)) hits++; // late share = 0.20
    }
    const rate = hits / N;
    assert.ok(Math.abs(rate - 0.2) < 0.005, `rate ${rate} not ~0.20`);
  });
});
