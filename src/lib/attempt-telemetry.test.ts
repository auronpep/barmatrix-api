import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interactionLogSchema,
  summarizeInteractionLog,
  MAX_EVENTS,
  type InteractionEvent,
} from "./attempt-telemetry.js";

const VALID_LOG: InteractionEvent[] = [
  { t: 0, ev: "shown" },
  { t: 18200, ev: "select", letter: "B" },
  { t: 41000, ev: "scroll_stem" },
  { t: 59300, ev: "select", letter: "A" },
  { t: 74100, ev: "submit", letter: "A" },
];

describe("interactionLogSchema", () => {
  it("accepts a valid ordered log", () => {
    const r = interactionLogSchema.safeParse(VALID_LOG);
    assert.equal(r.success, true);
  });

  it("rejects unknown event names (closed vocabulary)", () => {
    const r = interactionLogSchema.safeParse([
      { t: 0, ev: "shown" },
      { t: 5, ev: "mouse_move" },
    ]);
    assert.equal(r.success, false);
  });

  it("rejects non-monotonic timestamps", () => {
    const r = interactionLogSchema.safeParse([
      { t: 100, ev: "shown" },
      { t: 50, ev: "submit", letter: "A" },
    ]);
    assert.equal(r.success, false);
  });

  it("rejects select/submit without a letter", () => {
    const r = interactionLogSchema.safeParse([{ t: 0, ev: "submit" }]);
    assert.equal(r.success, false);
  });

  it("rejects logs longer than MAX_EVENTS", () => {
    const long = Array.from({ length: MAX_EVENTS + 1 }, (_, i) => ({
      t: i,
      ev: "scroll_stem" as const,
    }));
    const r = interactionLogSchema.safeParse(long);
    assert.equal(r.success, false);
  });
});

describe("summarizeInteractionLog", () => {
  it("derives all scalars from a full log", () => {
    const s = summarizeInteractionLog(VALID_LOG, "B");
    assert.equal(s.time_to_first_selection_ms, 18200);
    assert.equal(s.deliberation_ms, 74100 - 18200);
    assert.equal(s.answer_changes, 1); // two selects -> one change
    assert.equal(s.switched_off_correct, true); // selected B (correct) then submitted A
    assert.equal(s.stem_rereads, 1);
  });

  it("switched_off_correct is false when never on the correct letter", () => {
    const s = summarizeInteractionLog(VALID_LOG, "C");
    assert.equal(s.switched_off_correct, false);
  });

  it("switched_off_correct is false when submit IS the correct letter", () => {
    const s = summarizeInteractionLog(VALID_LOG, "A");
    assert.equal(s.switched_off_correct, false);
  });

  it("switched_off_correct is null when correct letter unknown", () => {
    const s = summarizeInteractionLog(VALID_LOG, null);
    assert.equal(s.switched_off_correct, null);
  });

  it("returns nulls/zeros for a log with no selections", () => {
    const s = summarizeInteractionLog([{ t: 0, ev: "shown" }], "A");
    assert.equal(s.time_to_first_selection_ms, null);
    assert.equal(s.deliberation_ms, null);
    assert.equal(s.answer_changes, 0);
    assert.equal(s.stem_rereads, 0);
  });
});
