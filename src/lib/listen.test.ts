import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleListenError } from "./listen.js";

function spy() {
  const errors: unknown[][] = [];
  const exits: number[] = [];
  return {
    errors,
    exits,
    logger: {
      error(...args: unknown[]) {
        errors.push(args);
      },
    },
    exit(code: number) {
      exits.push(code);
    },
  };
}

describe("handleListenError", () => {
  it("treats EADDRINUSE as an operational error: actionable message, exit 1", () => {
    const s = spy();
    const err: NodeJS.ErrnoException = new Error("listen EADDRINUSE");
    err.code = "EADDRINUSE";

    handleListenError(err, 8080, { logger: s.logger, exit: s.exit });

    assert.deepEqual(s.exits, [1]);
    assert.equal(s.errors.length, 1);
    const message = String(s.errors[0]?.[0]);
    assert.match(message, /8080/);
    assert.match(message, /already in use/i);
  });

  it("logs the raw error and exits 1 for non-EADDRINUSE bind failures", () => {
    const s = spy();
    const err: NodeJS.ErrnoException = new Error("listen EACCES");
    err.code = "EACCES";

    handleListenError(err, 80, { logger: s.logger, exit: s.exit });

    assert.deepEqual(s.exits, [1]);
    assert.equal(s.errors.length, 1);
    assert.match(String(s.errors[0]?.[0]), /80/);
  });
});
