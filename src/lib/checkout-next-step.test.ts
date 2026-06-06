import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeFromSessionAttemptCounts } from "./checkout-next-step.js";
import { DIAGNOSTIC_LENGTH } from "./diagnostic.js";

describe("routeFromSessionAttemptCounts", () => {
  it("routes to diagnostic when no sessions exist", () => {
    assert.deepEqual(routeFromSessionAttemptCounts([]), {
      diagnostic_completed: false,
      next_step: "diagnostic",
    });
  });

  it("routes to diagnostic when the only session is incomplete", () => {
    assert.deepEqual(routeFromSessionAttemptCounts([DIAGNOSTIC_LENGTH - 1]), {
      diagnostic_completed: false,
      next_step: "diagnostic",
    });
  });

  it("routes to foundations when a session has exactly DIAGNOSTIC_LENGTH attempts", () => {
    assert.deepEqual(routeFromSessionAttemptCounts([DIAGNOSTIC_LENGTH]), {
      diagnostic_completed: true,
      next_step: "foundations",
    });
  });

  it("routes to foundations when any single session is complete", () => {
    assert.deepEqual(routeFromSessionAttemptCounts([5, DIAGNOSTIC_LENGTH + 1]), {
      diagnostic_completed: true,
      next_step: "foundations",
    });
  });

  it("does not sum partial sessions into a completion", () => {
    assert.deepEqual(routeFromSessionAttemptCounts([11, 11]), {
      diagnostic_completed: false,
      next_step: "diagnostic",
    });
  });
});
