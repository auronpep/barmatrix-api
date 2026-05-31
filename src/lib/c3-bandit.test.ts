import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32, sampleGamma, sampleBeta, selectTarget, type SelectInput } from "./c3-bandit.js";
import type { MoldRow } from "./c3-scoring.js";

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

function row(p: Partial<MoldRow> & { mold_code: string }): MoldRow {
  return {
    mold_code: p.mold_code, family: p.family ?? "EAR_DISTORTION",
    weight: p.weight ?? 0.1, exposures: p.exposures ?? 0, bites: p.bites ?? 0,
    w_exposure: p.w_exposure ?? 0, w_bite: p.w_bite ?? 0,
  };
}

describe("selectTarget", () => {
  it("exploits a clearly weak, well-exposed mold over a strong one", () => {
    const input: SelectInput = {
      molds: [
        row({ mold_code: "weak",   weight: 0.1, exposures: 30, bites: 24, w_exposure: 60, w_bite: 48 }),
        row({ mold_code: "strong", weight: 0.1, exposures: 30, bites: 2,  w_exposure: 60, w_bite: 4 }),
      ],
      srsDue: { weak: true, strong: true },
      rng: mulberry32(1),
    };
    const counts = { weak: 0, strong: 0 };
    for (let i = 0; i < 200; i++) {
      const r = selectTarget({ ...input, rng: mulberry32(1000 + i) });
      if (r.target_mold === "weak") counts.weak++;
      else counts.strong++;
    }
    assert.ok(counts.weak > counts.strong * 3, JSON.stringify(counts));
  });

  it("cold start (no exposures) orders by exam weight", () => {
    const input: SelectInput = {
      molds: [
        row({ mold_code: "lowyield",  weight: 0.02 }),
        row({ mold_code: "highyield", weight: 0.20 }),
      ],
      srsDue: { lowyield: true, highyield: true },
      rng: mulberry32(2),
    };
    const counts = { lowyield: 0, highyield: 0 };
    for (let i = 0; i < 200; i++) {
      if (selectTarget({ ...input, rng: mulberry32(i) }).target_mold === "highyield") counts.highyield++;
      else counts.lowyield++;
    }
    assert.ok(counts.highyield > counts.lowyield, JSON.stringify(counts));
  });

  it("spacing penalty suppresses a not-due mold vs a near-equal due mold", () => {
    const base = { weight: 0.1, exposures: 20, bites: 12, w_exposure: 40, w_bite: 24 };
    const input: SelectInput = {
      molds: [row({ mold_code: "due", ...base }), row({ mold_code: "notdue", ...base })],
      srsDue: { due: true, notdue: false },
      rng: mulberry32(3),
    };
    const counts = { due: 0, notdue: 0 };
    for (let i = 0; i < 200; i++) {
      if (selectTarget({ ...input, rng: mulberry32(500 + i) }).target_mold === "due") counts.due++;
      else counts.notdue++;
    }
    assert.ok(counts.due > counts.notdue, JSON.stringify(counts));
  });

  it("returns deficit and a sorted ranking; empty molds -> null target", () => {
    const r = selectTarget({ molds: [], srsDue: {}, rng: mulberry32(4) });
    assert.equal(r.target_mold, null);
    const r2 = selectTarget({
      molds: [row({ mold_code: "m", weight: 0.1, exposures: 10, bites: 8, w_exposure: 20, w_bite: 16 })],
      srsDue: { m: true }, rng: mulberry32(5),
    });
    assert.equal(r2.target_mold, "m");
    assert.ok(r2.deficit >= 0 && r2.deficit <= 1);
    assert.equal(r2.ranking[0]!.mold_code, "m");
  });
});
