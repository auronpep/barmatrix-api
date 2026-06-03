import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flagQuality } from "./c3-flag-quality.js";

describe("flagQuality", () => {
  it("computes coin recognition and flag precision", () => {
    const q = flagQuality({
      flagged_wrong: 6,
      flagged_right: 2,
      unflagged_lowconf_miss: 4,
      flagged_total: 8,
      n: 50,
    });
    // recognizable = 6 + 4 = 10 -> 6/10
    assert.equal(q.coin_recognition_rate, 0.6);
    // precision = 6 / 8
    assert.equal(q.flag_precision, 0.75);
  });

  it("returns null rates when there is nothing to recognize / no flags", () => {
    const q = flagQuality({
      flagged_wrong: 0,
      flagged_right: 0,
      unflagged_lowconf_miss: 0,
      flagged_total: 0,
      n: 0,
    });
    assert.equal(q.coin_recognition_rate, null);
    assert.equal(q.flag_precision, null);
  });

  it("perfect recognition = 1.0", () => {
    const q = flagQuality({
      flagged_wrong: 5,
      flagged_right: 0,
      unflagged_lowconf_miss: 0,
      flagged_total: 5,
      n: 20,
    });
    assert.equal(q.coin_recognition_rate, 1);
    assert.equal(q.flag_precision, 1);
  });
});
