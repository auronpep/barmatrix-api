import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCheckoutSessionParams,
  resolveCheckoutReturnUrls,
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
    assert.deepEqual(params.line_items, [{ price: "price_full", quantity: 1 }]);
    assert.equal(params.success_url, "https://barmatrix.app/checkout/success");
    assert.equal(params.cancel_url, "https://barmatrix.app/pricing");
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
    assert.deepEqual(params.line_items, [{ price: "price_two", quantity: 1 }]);
    assert.deepEqual(params.payment_intent_data, {
      setup_future_usage: "off_session",
      metadata: { ...metadata, payment_plan: "two_pay_500_499" },
    });
  });
});
