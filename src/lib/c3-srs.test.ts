import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSrsState, isDue, type AttemptEvent } from "./c3-srs.js";

const DAY = 86_400_000;
const t0 = 1_700_000_000_000; // fixed epoch ms

describe("computeSrsState", () => {
  it("a bite lapses the bitten mold (interval reset to 1 day, ease down)", () => {
    const events: AttemptEvent[] = [
      { question_id: "q1", correct: false, bitten_mold: "half_truth", attempted_at_ms: t0 },
    ];
    const state = computeSrsState(events, { q1: ["half_truth"] });
    const s = state.get("half_truth")!;
    assert.equal(s.interval_days, 1);
    assert.ok(s.ease < 2.5 && s.ease >= 1.3);
    assert.equal(s.due_at_ms, t0 + DAY);
  });

  it("two correct exposures advance interval 1 -> 6 days", () => {
    const events: AttemptEvent[] = [
      { question_id: "q1", correct: true, bitten_mold: null, attempted_at_ms: t0 },
      { question_id: "q2", correct: true, bitten_mold: null, attempted_at_ms: t0 + DAY },
    ];
    const state = computeSrsState(events, { q1: ["misfit"], q2: ["misfit"] });
    const s = state.get("misfit")!;
    assert.equal(s.reps, 2);
    assert.equal(s.interval_days, 6);
    assert.equal(s.due_at_ms, t0 + DAY + 6 * DAY);
  });

  it("isDue: never-seen mold is due; future due_at is not due", () => {
    const state = computeSrsState(
      [{ question_id: "q1", correct: true, bitten_mold: null, attempted_at_ms: t0 }],
      { q1: ["misfit"] },
    );
    assert.equal(isDue(state, "never_seen", t0 + 10 * DAY), true);
    assert.equal(isDue(state, "misfit", t0), false);          // due_at = t0 + 1 day
    assert.equal(isDue(state, "misfit", t0 + 2 * DAY), true);
  });

  it("recompute is idempotent (same events -> same state)", () => {
    const events: AttemptEvent[] = [
      { question_id: "q1", correct: false, bitten_mold: "backwards", attempted_at_ms: t0 },
      { question_id: "q2", correct: true, bitten_mold: null, attempted_at_ms: t0 + DAY },
    ];
    const qm = { q1: ["backwards"], q2: ["backwards"] };
    assert.deepEqual([...computeSrsState(events, qm)], [...computeSrsState(events, qm)]);
  });
});
