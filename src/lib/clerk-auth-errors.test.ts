import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isClerkAuthFailure } from "./clerk-auth-errors.js";

describe("isClerkAuthFailure", () => {
  it("recognizes malformed Clerk bearer token failures", () => {
    const err = Object.assign(
      new Error("JWT string is malformed. (reason=token-invalid, token-carrier=header)"),
      {
        reason: "token-invalid",
        tokenCarrier: "header",
      },
    );

    assert.equal(isClerkAuthFailure(err), true);
  });

  it("recognizes rejected Clerk bearer token signatures", () => {
    const err = Object.assign(new Error("JWT signature is invalid."), {
      reason: "token-invalid-signature",
      tokenCarrier: "header",
    });

    assert.equal(isClerkAuthFailure(err), true);
  });

  it("recognizes Clerk token failures from the error message", () => {
    const err = new Error(
      "JWT string is malformed. (reason=token-invalid, token-carrier=header)",
    );

    assert.equal(isClerkAuthFailure(err), true);
  });

  it("recognizes Clerk JWT parser failures before a reason is attached", () => {
    const err = new SyntaxError("Unexpected end of data");
    err.stack = [
      "SyntaxError: Unexpected end of data",
      "    at parse (node_modules/@clerk/backend/dist/chunk-KDNHJOF3.mjs:70:11)",
      "    at decodeJwt (node_modules/@clerk/backend/dist/chunk-KDNHJOF3.mjs:320:54)",
      "    at verifyToken (node_modules/@clerk/backend/dist/chunk-CR4OQPUM.mjs:4958:43)",
      "    at async middleware (node_modules/@clerk/express/dist/index.mjs:127:28)",
    ].join("\n");

    assert.equal(isClerkAuthFailure(err), true);
  });

  it("does not hide unrelated server errors", () => {
    assert.equal(isClerkAuthFailure(new Error("database unavailable")), false);
    assert.equal(isClerkAuthFailure(new SyntaxError("Unexpected end of data")), false);
  });
});
