import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPACITY_COPY, publicCopyForCohortStatus } from "./copy.js";

describe("cohort public copy", () => {
  it("does not expose stale seat scarcity copy", () => {
    const copy = Object.values(CAPACITY_COPY).join("\n");

    assert.doesNotMatch(copy, /limited seats/i);
    assert.doesNotMatch(copy, /capacity reached/i);
    assert.doesNotMatch(copy, /last seats/i);
    assert.doesNotMatch(copy, /almost full/i);
  });

  it("normalizes database status bands to approved public copy", () => {
    assert.equal(
      publicCopyForCohortStatus("open"),
      "July-cycle cohort enrollment is open.",
    );
    assert.equal(
      publicCopyForCohortStatus("limited"),
      "July-cycle cohort enrollment is open.",
    );
    assert.equal(
      publicCopyForCohortStatus("waitlist"),
      "Enrollment is currently paused. Contact support for the next available start.",
    );
    assert.equal(
      publicCopyForCohortStatus("unexpected"),
      "July-cycle cohort enrollment is open.",
    );
  });
});
