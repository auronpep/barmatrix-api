import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  buildCheckoutSessionParams,
  resolveCheckoutReturnUrls,
  validateCheckoutSessionForRecovery,
} from "./checkout.js";

const defaults = {
  frontendUrl: "https://barmatrix.app",
  checkoutSuccess: "https://barmatrix.app/account/?welcome=1",
  checkoutCancel: "https://barmatrix.app/pricing/",
  nodeEnv: "production",
};

describe("checkout return URLs", () => {
  it("uses same-origin checkout return URLs from the frontend", () => {
    const urls = resolveCheckoutReturnUrls(
      {
        success_url:
          "https://barmatrix.app/checkout/success?payment_plan=pay_in_full&checkout_session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://barmatrix.app/pricing?checkout=cancelled",
      },
      defaults,
    );

    assert.equal(
      urls.successUrl,
      "https://barmatrix.app/checkout/success?payment_plan=pay_in_full&checkout_session_id={CHECKOUT_SESSION_ID}",
    );
    assert.equal(
      urls.cancelUrl,
      "https://barmatrix.app/pricing?checkout=cancelled",
    );
  });

  it("falls back to configured URLs when an override is off-origin", () => {
    const urls = resolveCheckoutReturnUrls(
      {
        success_url:
          "https://evil.example/checkout/success?checkout_session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://evil.example/pricing",
      },
      defaults,
    );

    assert.equal(urls.successUrl, defaults.checkoutSuccess);
    assert.equal(urls.cancelUrl, defaults.checkoutCancel);
  });

  it("allows local return URLs outside production", () => {
    const urls = resolveCheckoutReturnUrls(
      {
        success_url:
          "http://127.0.0.1:3000/checkout/success?checkout_session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/pricing?checkout=cancelled",
      },
      { ...defaults, nodeEnv: "development" },
    );

    assert.equal(
      urls.successUrl,
      "http://127.0.0.1:3000/checkout/success?checkout_session_id={CHECKOUT_SESSION_ID}",
    );
    assert.equal(
      urls.cancelUrl,
      "http://localhost:3000/pricing?checkout=cancelled",
    );
  });
});

describe("checkout session params", () => {
  const metadata = {
    cohort_code: "JULY_MBE_REPAIR",
    partner_id: "",
    referral_click_id: "",
    payment_plan: "pay_in_full",
  };

  it("creates a pay-in-full Stripe session that always has a customer", () => {
    const params = buildCheckoutSessionParams({
      paymentPlan: "pay_in_full",
      metadata,
      successUrl: "https://barmatrix.app/checkout/success",
      cancelUrl: "https://barmatrix.app/pricing",
      pricePayInFull: "price_full",
      pricePayInTwo: "price_two",
    });

    assert.equal(params.mode, "payment");
    assert.equal(params.customer_creation, "always");
    assert.equal(params.allow_promotion_codes, undefined);
    assert.equal(params.discounts, undefined);
    assert.deepEqual(params.line_items, [{ price: "price_full", quantity: 1 }]);
    assert.deepEqual(params.custom_fields, [
      {
        key: "first_name",
        label: { type: "custom", custom: "First name" },
        optional: false,
        type: "text",
        text: { maximum_length: 80, minimum_length: 1 },
      },
      {
        key: "last_name",
        label: { type: "custom", custom: "Last name" },
        optional: false,
        type: "text",
        text: { maximum_length: 80, minimum_length: 1 },
      },
    ]);
    assert.equal(params.success_url, "https://barmatrix.app/checkout/success");
    assert.equal(params.cancel_url, "https://barmatrix.app/pricing");
  });

  it("attaches a resolved Stripe promotion code and disables manual hosted entry", () => {
    const params = buildCheckoutSessionParams({
      paymentPlan: "pay_in_full",
      metadata: { ...metadata, coupon_code: "Jesuslovesyou" },
      successUrl: "https://barmatrix.app/checkout/success",
      cancelUrl: "https://barmatrix.app/pricing",
      pricePayInFull: "price_full",
      pricePayInTwo: "price_two",
      promotionCodeId: "promo_live_zero",
    });

    assert.equal(params.mode, "payment");
    assert.equal(params.allow_promotion_codes, undefined);
    assert.deepEqual(params.discounts, [{ promotion_code: "promo_live_zero" }]);
    assert.deepEqual(params.line_items, [{ price: "price_full", quantity: 1 }]);
  });

  it("creates a two-pay session that saves the card for the second installment", () => {
    const params = buildCheckoutSessionParams({
      paymentPlan: "two_pay_500_499",
      metadata: { ...metadata, payment_plan: "two_pay_500_499" },
      successUrl: "https://barmatrix.app/checkout/success",
      cancelUrl: "https://barmatrix.app/pricing",
      pricePayInFull: "price_full",
      pricePayInTwo: "price_two",
    });

    assert.equal(params.mode, "payment");
    assert.equal(params.customer_creation, "always");
    assert.equal(params.allow_promotion_codes, undefined);
    assert.equal(params.discounts, undefined);
    assert.deepEqual(params.line_items, [{ price: "price_two", quantity: 1 }]);
    assert.equal(params.custom_fields?.length, 2);
    assert.equal(params.custom_fields?.[0]?.key, "first_name");
    assert.equal(params.custom_fields?.[0]?.optional, false);
    assert.equal(params.custom_fields?.[1]?.key, "last_name");
    assert.equal(params.custom_fields?.[1]?.optional, false);
    assert.deepEqual(params.payment_intent_data, {
      setup_future_usage: "off_session",
      metadata: { ...metadata, payment_plan: "two_pay_500_499" },
    });
  });
});

describe("checkout recovery validation", () => {
  function recoverySession(
    overrides: Partial<Stripe.Checkout.Session> = {},
  ): Stripe.Checkout.Session {
    return {
      id: "cs_test_recover",
      object: "checkout.session",
      status: "complete",
      payment_status: "paid",
      metadata: {
        payment_plan: "pay_in_full",
      },
      ...overrides,
    } as unknown as Stripe.Checkout.Session;
  }

  it("allows completed paid BarMatrix sessions to be recovered", () => {
    assert.deepEqual(validateCheckoutSessionForRecovery(recoverySession()), {
      ok: true,
    });
  });

  it("rejects incomplete sessions before any local fulfillment", () => {
    assert.deepEqual(
      validateCheckoutSessionForRecovery(recoverySession({ status: "open" })),
      {
        ok: false,
        httpStatus: 409,
        error: "checkout_session_not_complete",
      },
    );
  });

  it("rejects unpaid sessions before any local fulfillment", () => {
    assert.deepEqual(
      validateCheckoutSessionForRecovery(
        recoverySession({ payment_status: "unpaid" }),
      ),
      {
        ok: false,
        httpStatus: 409,
        error: "checkout_session_not_paid",
      },
    );
  });

  it("rejects Stripe sessions that are not a BarMatrix checkout", () => {
    assert.deepEqual(
      validateCheckoutSessionForRecovery(recoverySession({ metadata: {} })),
      {
        ok: false,
        httpStatus: 400,
        error: "checkout_session_not_recoverable",
      },
    );
  });
});
