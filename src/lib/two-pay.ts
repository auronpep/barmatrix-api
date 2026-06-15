import type Stripe from "stripe";
import { config } from "../config.js";

/**
 * Idempotent 2-pay subscription arming. If a subscription already exists for
 * this checkout session, return it. Otherwise create the day-30 billing setup.
 */
export async function armTwoPaySubscription(
  session: Stripe.Checkout.Session,
  stripeClient: Stripe,
  logger: Pick<Console, "error" | "log"> = console,
): Promise<string | null> {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!customerId || !paymentIntentId) {
    logger.error(
      "[stripe two-pay] arming skipped: session missing customer/payment_intent",
      { sessionId: session.id, customerId, paymentIntentId },
    );
    return null;
  }

  const existing = await stripeClient.subscriptions.list({
    customer: customerId,
    limit: 10,
  });
  const reused = existing.data.find(
    (subscription) => subscription.metadata?.first_session_id === session.id,
  );
  if (reused) {
    logger.log(
      `[stripe two-pay] reusing sub=${reused.id} for session=${session.id}`,
    );
    return reused.id;
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  const paymentMethodId =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : (paymentIntent.payment_method?.id ?? null);
  if (!paymentMethodId) {
    throw new Error(
      `two-pay arming: no payment_method on payment_intent ${paymentIntentId}`,
    );
  }

  await stripeClient.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const now = Math.floor(Date.now() / 1000);
  const day30 = now + 30 * 86400;
  const day60 = now + 60 * 86400;

  const subscription = await stripeClient.subscriptions.create({
    customer: customerId,
    items: [{ price: config.stripe.priceFlagshipAnchor }],
    default_payment_method: paymentMethodId,
    billing_cycle_anchor: day30,
    proration_behavior: "none",
    cancel_at: day60,
    metadata: {
      payment_plan: "two_pay_500_499",
      first_session_id: session.id,
      cohort_code: config.cohort.code,
    },
  });

  await stripeClient.invoiceItems.create({
    customer: customerId,
    price: config.stripe.pricePayInTwoSecond,
    subscription: subscription.id,
  });

  logger.log(
    `[stripe two-pay] armed sub=${subscription.id} customer=${customerId} day30=${day30} day60=${day60}`,
  );
  return subscription.id;
}
