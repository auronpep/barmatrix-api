import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Clerk env so importing a module that pulls in @clerk/express stays happy,
// mirroring routes/questions.test.ts.
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";

const { normalizeEmail } = await import("./clerk-identity.js");

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeEmail("  Foo@Bar.COM  "), "foo@bar.com");
  });

  it("returns null for blank, whitespace, or missing input", () => {
    assert.equal(normalizeEmail(""), null);
    assert.equal(normalizeEmail("   "), null);
    assert.equal(normalizeEmail(null), null);
    assert.equal(normalizeEmail(undefined), null);
  });

  it("leaves an already-normal address unchanged", () => {
    assert.equal(normalizeEmail("student@barmatrix.app"), "student@barmatrix.app");
  });
});
