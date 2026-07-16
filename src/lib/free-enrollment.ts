import { createHash, randomUUID } from "node:crypto";
import { config } from "../config.js";
import { getPool, type DbClient, type DbPool } from "../db.js";
import { findOrCreateStudentByEmail } from "./clerk-identity.js";

export interface FreeEnrollmentCampaign {
  enabled: boolean;
  endsAt: string | null;
  campaign: string;
}

export interface ComplimentaryEnrollmentResult {
  studentId: string;
  enrolled: boolean;
  granted: boolean;
}

interface ComplimentaryEnrollmentDeps {
  db?: Pick<DbPool, "connect">;
  campaign?: FreeEnrollmentCampaign;
  now?: Date;
  createId?: () => string;
  enrollInCohort?: (
    client: DbClient,
    cohortId: string,
    studentId: string,
  ) => Promise<void>;
}

interface ActivePurchaseRow {
  purchase_id: string;
}

export function isFreeEnrollmentOpen(
  campaign: FreeEnrollmentCampaign,
  now = new Date(),
): boolean {
  if (!campaign.enabled) return false;
  if (!campaign.endsAt) return true;
  const endTime = Date.parse(campaign.endsAt);
  if (!Number.isFinite(endTime)) {
    throw new Error("FREE_ENROLLMENT_END must be a valid ISO date-time");
  }
  return now.getTime() < endTime;
}

/**
 * Resolve a Clerk user to the system-of-record student and, while the campaign
 * is open, atomically attach a real $0 complimentary entitlement. Existing
 * paid/complimentary access always wins and is never replaced.
 */
export async function ensureComplimentaryEnrollment(
  input: { userId: string; email: string },
  deps: ComplimentaryEnrollmentDeps = {},
): Promise<ComplimentaryEnrollmentResult> {
  const pool = deps.db ?? getPool();
  const campaign = deps.campaign ?? config.freeEnrollment;
  const now = deps.now ?? new Date();
  const createId = deps.createId ?? randomUUID;
  const enrollInCohort = deps.enrollInCohort ?? ensureComplimentaryCohortEnrollment;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const studentId = await findOrCreateStudentByEmail(client, input.email);
    const existing = await activePurchase(client, studentId);
    if (existing) {
      await client.query("COMMIT");
      return { studentId, enrolled: true, granted: false };
    }

    if (!isFreeEnrollmentOpen(campaign, now)) {
      await client.query("COMMIT");
      return { studentId, enrolled: false, granted: false };
    }

    const cohort = await client.query<{ cohort_id: string }>(
      "SELECT cohort_id FROM cohort_config WHERE cohort_code = $1 AND active = true LIMIT 1",
      [config.cohort.code],
    );
    const cohortId = cohort.rows[0]?.cohort_id;
    if (!cohortId) {
      throw new Error(
        `no active cohort_config row for cohort_code=${config.cohort.code}`,
      );
    }

    await enrollInCohort(client, cohortId, studentId);
    const checkoutSessionId = complimentarySessionId(input.userId);
    await client.query(
      `INSERT INTO purchases (
         purchase_id, student_id, cohort_id,
         stripe_customer_id, stripe_checkout_session_id, stripe_subscription_id,
         product_code, price_cents, payment_plan, net_collected_cents,
         partner_id, referral_click_id,
         refund_status, entitlement_status, metadata
       )
       VALUES ($1, $2, $3, NULL, $4, NULL, $5, 0, 'complimentary', 0,
               NULL, NULL, 'none', 'active',
               JSON_OBJECT('source', 'complimentary_registration', 'campaign', $6))
       ON DUPLICATE KEY UPDATE stripe_checkout_session_id = stripe_checkout_session_id`,
      [
        createId(),
        studentId,
        cohortId,
        checkoutSessionId,
        "barmatrix_free_july_2026",
        campaign.campaign,
      ],
    );
    await client.query(
      "UPDATE students SET status = 'enrolled', updated_at = CURRENT_TIMESTAMP(6) WHERE student_id = $1",
      [studentId],
    );
    const grantedPurchase = await activePurchase(client, studentId);
    if (!grantedPurchase) {
      throw new Error("complimentary entitlement insert did not produce active access");
    }

    await client.query("COMMIT");
    return { studentId, enrolled: true, granted: true };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original enrollment error.
    }
    throw err;
  } finally {
    client.release();
  }
}

async function activePurchase(
  db: DbClient,
  studentId: string,
): Promise<ActivePurchaseRow | null> {
  const result = await db.query<ActivePurchaseRow>(
    `SELECT purchase_id
       FROM purchases
      WHERE student_id = $1
        AND entitlement_status = 'active'
        AND refund_status = 'none'
      ORDER BY created_at DESC
      LIMIT 1`,
    [studentId],
  );
  return result.rows[0] ?? null;
}

function complimentarySessionId(userId: string): string {
  return `comp_${createHash("sha256").update(userId).digest("hex").slice(0, 40)}`;
}

async function ensureComplimentaryCohortEnrollment(
  db: DbClient,
  cohortId: string,
  studentId: string,
): Promise<void> {
  // Complimentary registration is intentionally not constrained by the paid
  // cohort seat cap. A NULL seat remains unique-safe while enrolled_at still
  // gives the guided path its program-start anchor.
  await db.query(
    `INSERT INTO cohort_enrollments (
       enrollment_id, cohort_id, student_id, seat_number, enrollment_status
     )
     VALUES (UUID(), $1, $2, NULL, 'active')
     ON DUPLICATE KEY UPDATE enrollment_status = 'active'`,
    [cohortId, studentId],
  );
}
