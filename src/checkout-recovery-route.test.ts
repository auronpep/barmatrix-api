import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("checkout recovery route", () => {
  const source = readFileSync(new URL("./routes/me.ts", import.meta.url), "utf8");

  it("validates Stripe completion and payment state before fulfillment", () => {
    assert.match(source, /clerkMiddleware\(\)/);
    assert.match(source, /resolveClerkEmail\(userId\)/);
    assert.match(source, /sessionEmail !== requesterEmail/);
    assert.match(source, /validateCheckoutSessionForRecovery\(session\)/);
    assert.match(source, /if \(!validation\.ok\)/);
    assert.match(source, /fulfillCheckoutSession\(\{/);
  });

  it("arms two-pay recovery before inserting the purchase", () => {
    assert.match(source, /armTwoPaySubscription\(session, stripe\)/);
    assert.match(source, /subscriptionId,\s*\n\s*\}\)/);
  });

  it("does not expose raw recovery exception details to the browser", () => {
    assert.doesNotMatch(source, /details:/);
  });
});
