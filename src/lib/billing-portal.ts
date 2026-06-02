import type Stripe from "stripe";
import { getPool, type DbPool } from "../db.js";

type CheckoutSessionReader = {
  retrieve: (sessionId: string) => Promise<Pick<Stripe.Checkout.Session, "customer">>;
};

interface BillingCustomerRecoveryInput {
  purchaseId: string;
  checkoutSessionId: string | null;
}

interface BillingCustomerRecoveryDeps {
  checkoutSessions: CheckoutSessionReader;
  db?: Pick<DbPool, "query">;
}

export async function recoverBillingCustomerFromCheckoutSession(
  input: BillingCustomerRecoveryInput,
  deps: BillingCustomerRecoveryDeps,
): Promise<string | null> {
  const checkoutSessionId = input.checkoutSessionId?.trim();
  if (!checkoutSessionId || !checkoutSessionId.startsWith("cs_")) {
    return null;
  }

  let session: Pick<Stripe.Checkout.Session, "customer">;
  try {
    session = await deps.checkoutSessions.retrieve(checkoutSessionId);
  } catch (err) {
    if (isMissingStripeCheckoutSession(err)) return null;
    throw err;
  }
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  if (!customerId) return null;

  const db = deps.db ?? getPool();
  await db.query(
    `UPDATE purchases
        SET stripe_customer_id = $1
      WHERE purchase_id = $2
        AND (stripe_customer_id IS NULL OR stripe_customer_id = '')`,
    [customerId, input.purchaseId],
  );

  return customerId;
}

function isMissingStripeCheckoutSession(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { code?: unknown; statusCode?: unknown };
  return candidate.statusCode === 404 || candidate.code === "resource_missing";
}
