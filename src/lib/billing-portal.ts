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

  const session = await deps.checkoutSessions.retrieve(checkoutSessionId);
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
