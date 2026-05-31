import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import type {
  StripeEventAuditClaim,
  StripeEventAuditCompletion,
  StripeEventAuditStore,
} from "./lib/stripe-event-audit.js";
import {
  twoPaySecondInvoiceFailed,
  twoPaySecondInvoiceSucceeded,
} from "./fixtures/stripe-events.js";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
process.env.BARMATRIX_DB_KEY = "test_password";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP = "prod_placeholder";
process.env.STRIPE_PRICE_PAY_IN_FULL = "price_placeholder_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR = "price_placeholder_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO = "price_placeholder_two";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND = "price_placeholder_second";
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const { redactStripeEventForAudit, runStripeEventWithAudit } = await import(
  "./lib/stripe-event-audit.js"
);

class MemoryAuditStore implements StripeEventAuditStore {
  statusById = new Map<string, "processing" | "processed" | "ignored" | "failed">();
  completions: StripeEventAuditCompletion[] = [];
  failures: string[] = [];

  async claim(event: Stripe.Event): Promise<StripeEventAuditClaim> {
    const status = this.statusById.get(event.id);
    if (status === "processed" || status === "ignored") {
      return { action: "skip", processingStatus: status };
    }
    if (status === "processing") {
      return { action: "in_progress" };
    }
    this.statusById.set(event.id, "processing");
    return { action: "process" };
  }

  async complete(
    eventId: string,
    completion: StripeEventAuditCompletion,
  ): Promise<void> {
    this.completions.push(completion);
    this.statusById.set(eventId, completion.processingStatus);
  }

  async fail(eventId: string, summary: string): Promise<void> {
    this.failures.push(summary);
    this.statusById.set(eventId, "failed");
  }
}

function checkoutCompletedEvent(): Stripe.Event {
  return {
    id: "evt_test_checkout_completed",
    object: "event",
    api_version: "2024-06-20",
    created: 1_717_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: "req_test",
      idempotency_key: "idem_test",
    },
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        customer: "cus_test_123",
        customer_details: {
          email: "buyer@example.test",
          name: "Buyer Example",
        },
        customer_email: "buyer@example.test",
        payment_intent: "pi_test_123",
        payment_method_details: {
          card: {
            last4: "4242",
          },
        },
        metadata: {
          payment_plan: "pay_in_full",
          referral_click_id: "11111111-1111-4111-8111-111111111111",
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook event audit", () => {
  it("does not run side effects again for an already processed event", async () => {
    const event = checkoutCompletedEvent();
    const store = new MemoryAuditStore();
    store.statusById.set(event.id, "processed");
    let sideEffects = 0;

    const outcome = await runStripeEventWithAudit({
      event,
      store,
      handleEvent: async () => {
        sideEffects += 1;
        return { processingStatus: "processed" };
      },
    });

    assert.deepEqual(outcome, {
      status: "replayed",
      processingStatus: "processed",
    });
    assert.equal(sideEffects, 0);
    assert.deepEqual(store.completions, []);
  });

  it("marks failed events without exposing raw sensitive payload fields", async () => {
    const event = checkoutCompletedEvent();
    const store = new MemoryAuditStore();

    await assert.rejects(
      () =>
        runStripeEventWithAudit({
          event,
          store,
          handleEvent: async () => {
            throw new Error(
              "fulfillment failed for buyer@example.test with card 4242",
            );
          },
        }),
      /fulfillment failed/,
    );

    assert.equal(store.statusById.get(event.id), "failed");
    assert.equal(store.failures.length, 1);
    assert.doesNotMatch(store.failures[0] ?? "", /buyer@example\.test/);
    assert.doesNotMatch(store.failures[0] ?? "", /4242/);
  });

  it("redacts customer emails, names, and card details from stored audit payloads", () => {
    const redacted = redactStripeEventForAudit(checkoutCompletedEvent());
    const serialized = JSON.stringify(redacted);

    assert.doesNotMatch(serialized, /buyer@example\.test/);
    assert.doesNotMatch(serialized, /Buyer Example/);
    assert.doesNotMatch(serialized, /4242/);
    assert.doesNotMatch(serialized, /customer_details/);
    assert.doesNotMatch(serialized, /payment_method_details/);
    assert.match(serialized, /metadata_keys/);
    assert.match(serialized, /checkout\.session/);
  });

  it("keeps local Stripe proof fixtures free of secrets and card details", () => {
    const serialized = JSON.stringify([
      twoPaySecondInvoiceSucceeded(),
      twoPaySecondInvoiceFailed(),
    ]);

    assert.doesNotMatch(
      serialized,
      /\b(?:sk|rk|whsec)_(?:live|test)?_[A-Za-z0-9_]+\b/,
    );
    assert.doesNotMatch(
      serialized,
      /payment_method_details|card|last4|exp_month|exp_year|cvc|card_number/i,
    );
    assert.doesNotMatch(serialized, /\b(?:4242|4000\s?0000\s?0000\s?\d{4})\b/);
  });
});
