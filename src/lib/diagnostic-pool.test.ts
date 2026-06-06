import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectDiagnosticPool } from "./diagnostic-pool.js";
import { DIAGNOSTIC_POOL } from "./diagnostic-pool.data.js";

// Deterministic LCG so tests are stable (no Math.random).
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

describe("selectDiagnosticPool", () => {
  it("returns 12 ids, hard-set first in order", () => {
    const ids = selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(1));
    assert.equal(ids.length, 12);
    const hardSet = DIAGNOSTIC_POOL.filter((q) => q.role === "hard_set")
      .sort((a, b) => a.order - b.order)
      .map((q) => q.externalId);
    assert.deepEqual(ids.slice(0, 6), hardSet);
  });

  it("never serves bench items", () => {
    const bench = new Set(
      DIAGNOSTIC_POOL.filter((q) => q.role === "bench").map((q) => q.externalId),
    );
    for (let seed = 1; seed <= 50; seed++) {
      for (const id of selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(seed))) {
        assert.ok(!bench.has(id), `bench item ${id} was served`);
      }
    }
  });

  it("includes Real Property every run (only uncovered subject → subject-first pull)", () => {
    const rp = new Set(
      DIAGNOSTIC_POOL.filter((q) => q.subject === "REAL_PROPERTY").map((q) => q.externalId),
    );
    let rpRuns = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const ids = selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(seed));
      if (ids.some((id) => rp.has(id))) rpRuns++;
    }
    assert.ok(rpRuns >= 45, `RP appeared in only ${rpRuns}/50 runs`);
  });

  it("produces 12 distinct ids", () => {
    const ids = selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(9));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("is deterministic for a fixed seed", () => {
    assert.deepEqual(
      selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(7)),
      selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(7)),
    );
  });
});
