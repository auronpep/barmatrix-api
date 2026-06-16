import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Guards the live-money 2-pay arming implementation. A behavioral test would
 * require booting `config` (external secrets), which the rest of this suite
 * intentionally avoids — so, matching the house pattern used by the webhook
 * audit and recovery-route tests, these assert the money-critical invariants
 * directly against the source. The two failure modes guarded against are an
 * incorrect billing date / missing second installment, and double-arming a
 * customer who already has a subscription for this session (a double charge).
 */
describe("two-pay arming implementation", () => {
  const source = readFileSync(new URL("./two-pay.ts", import.meta.url), "utf8");

  it("anchors the first installment's recurring billing at day 30 and cancels at day 60", () => {
    assert.match(source, /day30\s*=\s*now\s*\+\s*30\s*\*\s*86400/);
    assert.match(source, /day60\s*=\s*now\s*\+\s*60\s*\*\s*86400/);
    assert.match(source, /billing_cycle_anchor:\s*day30/);
    assert.match(source, /cancel_at:\s*day60/);
  });

  it("is idempotent: reuses the subscription tagged with first_session_id instead of arming a second one", () => {
    assert.match(
      source,
      /metadata\?\.first_session_id\s*===\s*session\.id/,
    );
    // The reuse path must short-circuit BEFORE any subscriptions.create call.
    const reuseIdx = source.indexOf("return reused.id");
    const createIdx = source.indexOf("subscriptions.create");
    assert.ok(reuseIdx > -1, "has a reuse short-circuit");
    assert.ok(createIdx > -1, "creates a subscription on the fresh path");
    assert.ok(
      reuseIdx < createIdx,
      "reuse short-circuit must precede subscription creation",
    );
  });

  it("stamps the session id so future arming attempts are deduplicated", () => {
    assert.match(source, /first_session_id:\s*session\.id/);
  });

  it("attaches the $499 second installment as a pending invoice item", () => {
    assert.match(source, /invoiceItems\.create/);
    assert.match(source, /price:\s*config\.stripe\.pricePayInTwoSecond/);
  });

  it("saves the card as the customer's default so day 30 can auto-charge", () => {
    assert.match(
      source,
      /invoice_settings:\s*\{\s*default_payment_method:\s*paymentMethodId/,
    );
  });

  it("skips arming (returns null) when customer or payment_intent is missing", () => {
    assert.match(source, /if\s*\(!customerId\s*\|\|\s*!paymentIntentId\)/);
    assert.match(source, /return null/);
  });
});
