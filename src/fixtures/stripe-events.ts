import type Stripe from "stripe";

export const stripeFixtureIds = {
  twoPaySubscription: "sub_test_two_pay_fixture",
  secondInvoiceSucceeded: "in_test_two_pay_second_succeeded",
  secondInvoiceFailed: "in_test_two_pay_second_failed",
  customer: "cus_test_two_pay_fixture",
} as const;

export function twoPaySecondInvoiceSucceeded(
  overrides: Partial<Stripe.Invoice> = {},
): Stripe.Invoice {
  return {
    id: stripeFixtureIds.secondInvoiceSucceeded,
    object: "invoice",
    amount_paid: 49900,
    customer: stripeFixtureIds.customer,
    livemode: false,
    status: "paid",
    subscription: stripeFixtureIds.twoPaySubscription,
    metadata: {
      payment_plan: "two_pay_500_499",
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

export function twoPaySecondInvoiceFailed(
  overrides: Partial<Stripe.Invoice> = {},
): Stripe.Invoice {
  return {
    id: stripeFixtureIds.secondInvoiceFailed,
    object: "invoice",
    amount_due: 49900,
    amount_paid: 0,
    customer: stripeFixtureIds.customer,
    livemode: false,
    status: "open",
    subscription: stripeFixtureIds.twoPaySubscription,
    metadata: {
      payment_plan: "two_pay_500_499",
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}
