// Webhook-driven business logic for converting a successful Stripe charge
// into our system-of-record state: student row, purchase row, cohort seat,
// referral conversion. All handlers must be idempotent — Stripe retries
// webhook deliveries and our checkout.session.completed handler can fire
// twice for the same session.

import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { getPool, type DbClient } from "./db.js";
import { config } from "./config.js";

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

/**
 * Convert a completed Stripe Checkout Session into our DB state.
 * Idempotent: a second call with the same session.id returns "duplicate".
 */
export async function fulfillCheckoutSession(
  input: FulfillCheckoutInput,
): Promise<FulfillCheckoutResult> {
  const { session, subscriptionId } = input;

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
  const fullName = session.customer_details?.name ?? null;
  const referralClickId = parseUuidOrNull(session.metadata?.referral_click_id);

  // amount_total is what Stripe actually charged on this Checkout session.
  // For pay-in-full it's 99900 (full $999). For two-pay it's 50000 (the $500
  // first installment). The day-30 second installment is recorded later via
  // recordInstallmentPayment.
  const netCollectedCents = session.amount_total ?? 0;

  const pool = getPool();
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
    const studentId = studentLookup.rows[0]!.student_id;

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
        console.warn(
          `[entitlement] referral_click_id ${referralClickId} on session ${session.id} not found in referral_clicks`,
        );
      }
    }

    // ---- Insert purchase ----
    const purchaseId = randomUUID();
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

    // ---- Assign cohort seat (with retry on seat_number race) ----
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

    console.log(
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
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);
  if (!subscriptionId) {
    return; // not a subscription invoice — ignore
  }

  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid <= 0) {
    return;
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
      return;
    }

    // Idempotency: track which invoice IDs we've already accumulated.
    const recorded = getRecordedInvoices(row.metadata);
    if (recorded.includes(invoice.id)) {
      await client.query("ROLLBACK");
      return;
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
export async function suspendEntitlement(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);
  if (!subscriptionId) {
    return;
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
    console.warn(
      `[entitlement] suspended purchase=${purchase.rows[0]?.purchase_id ?? "unknown"} subscription=${subscriptionId} invoice=${invoice.id}`,
    );
  } else {
    console.warn(
      `[entitlement] payment_failed for subscription=${subscriptionId} invoice=${invoice.id} — no matching purchase or already suspended`,
    );
  }
}

// ---- Helpers ----

function parseUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function assignSeat(
  client: DbClient,
  cohortId: string,
  studentId: string,
): Promise<number> {
  // Try-and-retry pattern: compute MAX(seat_number)+1 inside the insert, fall
  // back to the existing seat number on student conflict, retry on the
  // (cohort_id, seat_number) unique race.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const existing = await client.query<{ seat_number: number }>(
        `SELECT seat_number
           FROM cohort_enrollments
          WHERE cohort_id = $1 AND student_id = $2
          LIMIT 1`,
        [cohortId, studentId],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE cohort_enrollments
              SET enrollment_status = 'active'
            WHERE cohort_id = $1 AND student_id = $2`,
          [cohortId, studentId],
        );
        return Number(existing.rows[0].seat_number);
      }

      const enrollmentId = randomUUID();
      await client.query(
        `INSERT INTO cohort_enrollments (
           enrollment_id, cohort_id, student_id, seat_number, enrollment_status
         )
         SELECT $1, $2, $3, COALESCE(MAX(seat_number), 0) + 1, 'active'
           FROM cohort_enrollments
          WHERE cohort_id = $2`,
        [enrollmentId, cohortId, studentId],
      );

      const inserted = await client.query<{ seat_number: number }>(
        "SELECT seat_number FROM cohort_enrollments WHERE enrollment_id = $1 LIMIT 1",
        [enrollmentId],
      );
      return Number(inserted.rows[0]!.seat_number);
    } catch (err: unknown) {
      if (isSeatNumberRace(err)) {
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `seat assignment failed after 5 attempts (cohort=${cohortId} student=${studentId})`,
  );
}

function isSeatNumberRace(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; errno?: number; message?: string };
  return (
    e.code === "ER_DUP_ENTRY" &&
    (e.errno === 1062 || e.message?.includes("uq_cohort_seat") === true)
  );
}

function getRecordedInvoices(metadata: unknown): string[] {
  const parsed =
    typeof metadata === "string" ? (JSON.parse(metadata) as unknown) : metadata;
  if (typeof parsed !== "object" || parsed === null) return [];
  const invoices = (parsed as { recorded_invoices?: unknown }).recorded_invoices;
  return Array.isArray(invoices)
    ? invoices.filter((value): value is string => typeof value === "string")
    : [];
}
