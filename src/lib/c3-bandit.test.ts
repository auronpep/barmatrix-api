import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32, sampleGamma, sampleBeta } from "./c3-bandit.js";

describe("rng + samplers", () => {
  it("mulberry32 is deterministic for a fixed seed", () => {
    const a = mulberry32(42); const b = mulberry32(42);
    assert.equal(a(), b());
    const x = a(); assert.ok(x >= 0 && x < 1);
  });

  it("sampleGamma mean ~ shape (k) for k>=1", () => {
    const rng = mulberry32(7);
    let s = 0; const N = 4000;
    for (let i = 0; i < N; i++) s += sampleGamma(3, rng);
    const mean = s / N;
    assert.ok(Math.abs(mean - 3) < 0.3, `gamma mean ${mean}`);
  });

  it("sampleBeta(a,b) mean ~ a/(a+b) and stays in (0,1)", () => {
    const rng = mulberry32(99);
    let s = 0; const N = 4000;
    for (let i = 0; i < N; i++) {
      const v = sampleBeta(2, 8, rng);
      assert.ok(v > 0 && v < 1);
      s += v;
    }
    const mean = s / N;
    assert.ok(Math.abs(mean - 0.2) < 0.03, `beta mean ${mean}`);
  });
});
