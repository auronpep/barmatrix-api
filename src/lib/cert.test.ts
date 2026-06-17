// barmatrix-api/src/lib/cert.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
const { getCertOutline, cooldownMsFor, overallStatus, COOLDOWN_STEPS_MS } = await import("./cert.js");

describe("cert content", () => {
  it("outline lists no live competencies while certification content is reset", () => {
    const o = getCertOutline();
    assert.deepEqual(o.competencies, []);
    assert.equal(o.preview, true);
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
  it("stays NOT_YET while no certification competencies are live", () => {
    const all = Object.fromEntries(["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10"].map((id) => [id, true]));
    assert.equal(overallStatus(all), "NOT_YET");
    assert.equal(overallStatus({}), "NOT_YET");
  });
});
