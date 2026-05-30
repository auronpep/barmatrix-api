// barmatrix-api/src/lib/cert.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
const { getCertOutline, cooldownMsFor, overallStatus, COOLDOWN_STEPS_MS } = await import("./cert.js");

describe("cert content", () => {
  it("outline lists M1..M10 with pass specs and key-free items", () => {
    const o = getCertOutline();
    assert.deepEqual(o.competencies.map((c) => c.id), ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10"]);
    const item = o.competencies[0]!.items[0]! as unknown as Record<string, unknown>;
    assert.ok(item.prompt);
    for (const k of ["key","explanation","mechanism","is_fork","key_answer"]) assert.ok(!(k in item));
  });
});

describe("cooldown", () => {
  it("escalates 0 -> 1h -> 24h -> 72h (capped)", () => {
    assert.deepEqual(COOLDOWN_STEPS_MS, [0, 3600_000, 86_400_000, 259_200_000]);
    assert.equal(cooldownMsFor(0), 0);
    assert.equal(cooldownMsFor(1), 3600_000);
    assert.equal(cooldownMsFor(9), 259_200_000); // capped
  });
});

describe("overallStatus", () => {
  it("CONFIRMED only when all 10 competencies passed", () => {
    const all = Object.fromEntries(["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10"].map((id) => [id, true]));
    assert.equal(overallStatus(all), "CONFIRMED");
    assert.equal(overallStatus({ ...all, M10: false }), "NOT_YET");
    assert.equal(overallStatus({}), "NOT_YET");
  });
});
