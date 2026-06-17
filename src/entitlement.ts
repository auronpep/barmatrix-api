// Webhook-driven business logic for converting a successful Stripe charge
// into our system-of-record state: student row, purchase row, cohort seat,
// referral conversion. All handlers must be idempotent — Stripe retries
// webhook deliveries and our checkout.session.completed handler can fire
// twice for the same session.

import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { getPool, type DbClient, type DbPool } from "./db.js";
import { config } from "./config.js";
import { assignSeatWithinCapacity } from "./lib/capacity.js";

const REFERRAL_COMMISSION_CENTS = 19900; // $199 per RULES.md
const COHORT_PRICE_CENTS = 99900; // $999 flat per RULES.md
const PRODUCT_CODE = "barmatrix_flagship_999";

interface FulfillCheckoutInput {
  session: Stripe.Checkout.Session;
  subscriptionId: string | null;
}

interface FulfillCheckoutResult {
  status: "fulfilled" | "duplicate";
  purchaseId?: string;
  studentId?: string;
  seatNumber?: number;
}

interface FulfillCheckoutDeps {
  pool?: Pick<DbPool, "connect">;
  createId?: () => string;
  assignSeat?: (
    client: DbClient,
    cohortId: string,
    studentId: string,
  ) => Promise<number>;
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Convert a completed Stripe Checkout Session into our DB state.
 * Idempotent: a second call with the same session.id returns "duplicate".
 */
export async function fulfillCheckoutSession(
  input: FulfillCheckoutInput,
  deps: FulfillCheckoutDeps = {},
): Promise<FulfillCheckoutResult> {
  const { session, subscriptionId } = input;
  const pool = deps.pool ?? getPool();
  const createId = deps.createId ?? randomUUID;
  const assignSeat = deps.assignSeat ?? assignSeatWithinCapacity;
  const logger = deps.logger ?? console;

  const email = session.customer_details?.email?.toLowerCase().trim();
  if (!email) {
    throw new Error(`session ${session.id} has no customer email`);
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  const paymentPlan =
    session.metadata?.payment_plan === "two_pay_500_499"
      ? "two_pay_500_499"
      : "pay_in_full";
  const fullName = checkoutFullName(session);
  const referralClickId = parseUuidOrNull(session.metadata?.referral_click_id);

  // amount_total is what Stripe actually charged on this Checkout session.
  // For pay-in-full it's 99900 (full $999). For two-pay it's 50000 (the $500
  // first installment). The day-30 second installment is recorded later via
  // recordInstallmentPayment.
  const netCollectedCents = session.amount_total ?? 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ---- Idempotency check ----
    const existing = await client.query<{ purchase_id: string }>(
      "SELECT purchase_id FROM purchases WHERE stripe_checkout_session_id = $1 LIMIT 1",
      [session.id],
    );
    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return { status: "duplicate", purchaseId: existing.rows[0]!.purchase_id };
    }

    // ---- Upsert student by email ----
    await client.query(
      `INSERT INTO students (email, full_name, status, consent_flags)
       VALUES ($1, $2, 'enrolled', JSON_OBJECT())
       ON DUPLICATE KEY UPDATE
         full_name = COALESCE(VALUES(full_name), full_name),
         status = 'enrolled',
         updated_at = CURRENT_TIMESTAMP(6)`,
      [email, fullName],
    );
    const studentLookup = await client.query<{ student_id: string }>(
      "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
      [email],
    );
    if (!studentLookup.rows[0]) {
      throw new Error(
        `student lookup failed after upsert for email=${email}`,
      );
    }
    const studentId = studentLookup.rows[0].student_id;

    // ---- Look up cohort ----
    const cohortLookup = await client.query<{ cohort_id: string }>(
      "SELECT cohort_id FROM cohort_config WHERE cohort_code = $1 AND active = true LIMIT 1",
      [config.cohort.code],
    );
    const cohortRow = cohortLookup.rows[0];
    if (!cohortRow) {
      throw new Error(
        `no active cohort_config row for cohort_code=${config.cohort.code}`,
      );
    }
    const cohortId = cohortRow.cohort_id;

    // ---- Resolve partner from referral_click_id if present ----
    let partnerId: string | null = null;
    if (referralClickId) {
      const clickLookup = await client.query<{ partner_id: string | null }>(
        "SELECT partner_id FROM referral_clicks WHERE referral_click_id = $1 LIMIT 1",
        [referralClickId],
      );
      partnerId = clickLookup.rows[0]?.partner_id ?? null;
      if (!clickLookup.rows[0]) {
        logger.warn(
          `[entitlement] referral_click_id ${referralClickId} on session ${session.id} not found in referral_clicks`,
        );
      }
    }

    // ---- Insert purchase ----
    const purchaseId = createId();
    try {
      await client.query(
        `INSERT INTO purchases (
           purchase_id, student_id, cohort_id,
           stripe_customer_id, stripe_checkout_session_id, stripe_subscription_id,
           product_code, price_cents, payment_plan, net_collected_cents,
           partner_id, referral_click_id,
           refund_status, entitlement_status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'none', 'active', JSON_OBJECT())`,
        [
          purchaseId,
          studentId,
          cohortId,
          stripeCustomerId,
          session.id,
          subscriptionId,
          PRODUCT_CODE,
          COHORT_PRICE_CENTS,
          paymentPlan,
          netCollectedCents,
          partnerId,
          referralClickId,
        ],
      );
    } catch (err) {
      if (isDuplicateCheckoutSessionError(err)) {
        const duplicate = await client.query<{ purchase_id: string }>(
          "SELECT purchase_id FROM purchases WHERE stripe_checkout_session_id = $1 LIMIT 1",
          [session.id],
        );
        const row = duplicate.rows[0];
        if (row) {
          await client.query("COMMIT");
          return { status: "duplicate", purchaseId: row.purchase_id };
        }
      }
      throw err;
    }

    // ---- Assign cohort seat under a cohort row lock and internal-cap check ----
    const seatNumber = await assignSeat(client, cohortId, studentId);

    // ---- Referral conversion (only if partner attribution resolved) ----
    if (partnerId) {
      await client.query(
        `INSERT IGNORE INTO referral_conversions (
           partner_id, student_id, purchase_id, commission_cents, status
         )
         VALUES ($1, $2, $3, $4, 'pending')`,
        [partnerId, studentId, purchaseId, REFERRAL_COMMISSION_CENTS],
      );
    }

    await client.query("COMMIT");

    logger.log(
      `[entitlement] fulfilled session=${session.id} student=${studentId} purchase=${purchaseId} seat=${seatNumber} plan=${paymentPlan} partner=${partnerId ?? "none"}`,
    );

    return {
      status: "fulfilled",
      purchaseId,
      studentId,
      seatNumber,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Record a successful subscription invoice payment against the 2-pay purchase.
 * Currently called for invoice.payment_succeeded events tied to a subscription.
 * Idempotent: looks up purchase by stripe_subscription_id and accumulates
 * net_collected_cents, but only if we haven't already counted this invoice.
 */
export async function recordInstallmentPayment(
  invoice: Stripe.Invoice,
): Promise<{ recorded: boolean; purchaseId?: string }> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);
  if (!subscriptionId) {
    return { recorded: false }; // not a subscription invoice — ignore
  }

  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid <= 0) {
    return { recorded: false };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const purchase = await client.query<{
      purchase_id: string;
      metadata: unknown;
    }>(
      "SELECT purchase_id, metadata FROM purchases WHERE stripe_subscription_id = $1 LIMIT 1",
      [subscriptionId],
    );
    const row = purchase.rows[0];
    if (!row) {
      console.warn(
        `[entitlement] invoice.payment_succeeded for unknown subscription=${subscriptionId} invoice=${invoice.id}`,
      );
      await client.query("ROLLBACK");
      return { recorded: false };
    }

    // Idempotency: track which invoice IDs we've already accumulated.
    const recorded = getRecordedInvoices(row.metadata);
    if (recorded.includes(invoice.id)) {
      await client.query("ROLLBACK");
      return { recorded: false };
    }
    recorded.push(invoice.id ?? "unknown");

    await client.query(
      `UPDATE purchases
         SET net_collected_cents = COALESCE(net_collected_cents, 0) + $1,
             metadata = JSON_SET(
               COALESCE(metadata, JSON_OBJECT()),
               '$.recorded_invoices',
               JSON_EXTRACT($2, '$')
             )
       WHERE purchase_id = $3`,
      [amountPaid, JSON.stringify(recorded), row.purchase_id],
    );

    await client.query("COMMIT");
    console.log(
      `[entitlement] installment recorded: purchase=${row.purchase_id} invoice=${invoice.id} amount=${amountPaid} subscription=${subscriptionId}`,
    );
    return { recorded: true, purchaseId: row.purchase_id };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Suspend the entitlement attached to a subscription whose invoice failed.
 * Fires on invoice.payment_failed for our 2-pay subscriptions.
 * Idempotent: setting entitlement_status='suspended' multiple times is a no-op.
 */
export async function suspendEntitlement(
  invoice: Stripe.Invoice,
): Promise<{ suspended: boolean; purchaseId?: string }> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);
  if (!subscriptionId) {
    return { suspended: false };
  }

  const pool = getPool();
  const result = await pool.query(
    `UPDATE purchases
       SET entitlement_status = 'suspended'
     WHERE stripe_subscription_id = $1
       AND entitlement_status <> 'suspended'`,
    [subscriptionId],
  );

  if (result.rowCount && result.rowCount > 0) {
    const purchase = await pool.query<{ purchase_id: string }>(
      "SELECT purchase_id FROM purchases WHERE stripe_subscription_id = $1 LIMIT 1",
      [subscriptionId],
    );
    const purchaseId = purchase.rows[0]?.purchase_id;
    console.warn(
      `[entitlement] suspended purchase=${purchaseId ?? "unknown"} subscription=${subscriptionId} invoice=${invoice.id}`,
    );
    return { suspended: true, purchaseId };
  }

  console.warn(
    `[entitlement] payment_failed for subscription=${subscriptionId} invoice=${invoice.id} — no matching purchase or already suspended`,
  );
  return { suspended: false };
}

// ---- Helpers ----

function parseUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function checkoutFullName(session: Stripe.Checkout.Session): string | null {
  const firstName = checkoutCustomTextValue(session, "first_name");
  const lastName = checkoutCustomTextValue(session, "last_name");
  const customFullName =
    firstName || lastName ? [firstName, lastName].filter(Boolean).join(" ") : null;

  return customFullName ?? clean(session.customer_details?.name);
}

function checkoutCustomTextValue(
  session: Stripe.Checkout.Session,
  key: string,
): string | null {
  const field = session.custom_fields?.find((item) => item.key === key);
  return clean(field?.text?.value ?? null);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isDuplicateCheckoutSessionError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: string;
    errno?: number;
    message?: string;
    sqlMessage?: string;
  };
  // mysql2 populates `code` and `errno` independently across versions/configs;
  // treat the error as a duplicate-key violation if EITHER signal matches,
  // still gated on the message referencing the checkout-session constraint so
  // we never mistake an unrelated duplicate for this one.
  const isDupKey = e.code === "ER_DUP_ENTRY" || e.errno === 1062;
  const message = `${e.message ?? ""} ${e.sqlMessage ?? ""}`;
  return (
    isDupKey &&
    (message.includes("uq_purchases_checkout_session") ||
      message.includes("stripe_checkout_session_id"))
  );
}

function getRecordedInvoices(metadata: unknown): string[] {
  let parsed: unknown;
  if (typeof metadata === "string") {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      console.warn("[entitlement] getRecordedInvoices: malformed metadata JSON, treating as empty");
      return [];
    }
  } else {
    parsed = metadata;
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const invoices = (parsed as { recorded_invoices?: unknown }).recorded_invoices;
  return Array.isArray(invoices)
    ? invoices.filter((value): value is string => typeof value === "string")
    : [];
}
