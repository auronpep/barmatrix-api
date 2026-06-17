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
  it("returns no ids while the diagnostic pool is reset", () => {
    const ids = selectDiagnosticPool(DIAGNOSTIC_POOL, seededRng(1));
    assert.deepEqual(ids, []);
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

  it("produces distinct ids", () => {
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
