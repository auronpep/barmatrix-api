import type Stripe from "stripe";

export type CheckoutPaymentPlan = "pay_in_full" | "two_pay_500_499";

export interface CheckoutReturnUrlInput {
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutReturnUrlDefaults {
  frontendUrl: string;
  checkoutSuccess: string;
  checkoutCancel: string;
  nodeEnv: string;
}

export interface CheckoutReturnUrls {
  successUrl: string;
  cancelUrl: string;
}

export interface BuildCheckoutSessionParamsInput {
  paymentPlan: CheckoutPaymentPlan;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  pricePayInFull: string;
  pricePayInTwo: string;
  promotionCodeId?: string;
}

const LOCAL_DEV_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function resolveCheckoutReturnUrls(
  input: CheckoutReturnUrlInput,
  defaults: CheckoutReturnUrlDefaults,
): CheckoutReturnUrls {
  return {
    successUrl: safeReturnUrl(input.success_url, defaults.checkoutSuccess, defaults),
    cancelUrl: safeReturnUrl(input.cancel_url, defaults.checkoutCancel, defaults),
  };
}

export function buildCheckoutSessionParams(
  input: BuildCheckoutSessionParamsInput,
): Stripe.Checkout.SessionCreateParams {
  const discountFields = input.promotionCodeId
    ? { discounts: [{ promotion_code: input.promotionCodeId }] }
    : { allow_promotion_codes: true };

  if (input.paymentPlan === "pay_in_full") {
    return {
      mode: "payment",
      customer_creation: "always",
      ...discountFields,
      line_items: [{ price: input.pricePayInFull, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
    };
  }

  return {
    mode: "payment",
    ...discountFields,
    line_items: [{ price: input.pricePayInTwo, quantity: 1 }],
    customer_creation: "always",
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: input.metadata,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  };
}

function safeReturnUrl(
  candidate: string | undefined,
  fallback: string,
  defaults: CheckoutReturnUrlDefaults,
): string {
  if (!candidate) return fallback;
  return isAllowedReturnUrl(candidate, defaults) ? candidate : fallback;
}

function isAllowedReturnUrl(
  value: string,
  defaults: CheckoutReturnUrlDefaults,
): boolean {
  try {
    const url = new URL(value);
    const frontend = new URL(defaults.frontendUrl);
    if (url.origin === frontend.origin) return true;
    return defaults.nodeEnv !== "production" && LOCAL_DEV_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}
