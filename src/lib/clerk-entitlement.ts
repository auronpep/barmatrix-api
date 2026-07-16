// Clerk -> enrollment bridge for paid-route protection.
//
// Companion to clerk-identity.ts (identity resolution) and entitlement.ts
// (Stripe webhook fulfillment). Answers one question: is this Clerk session
// holder currently enrolled with an active, non-refunded purchase?
//
// Usage in routes:
//   app.post("/api/drills/start", ...requireEnrollment(), async (req, res) => {
//     const studentId = res.locals.enrolledStudentId as string;
//     ...
//   });

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { getPool, type DbPool } from "../db.js";
import { resolveClerkEmail } from "./clerk-identity.js";
import { ensureComplimentaryEnrollment } from "./free-enrollment.js";

export interface EnrollmentResult {
  studentId: string | null;
  enrolled: boolean;
}

interface PurchaseRow {
  student_id: string;
  entitlement_status: string;
  refund_status: string;
}

interface BillingPortalPurchaseRow extends PurchaseRow {
  purchase_id: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
}

type AuthForRequest = (req: Request) => { userId?: string | null };
type EnrollmentCheck = (userId: string) => Promise<EnrollmentResult>;
type MissingBillingCustomerResolver = (purchase: {
  purchaseId: string;
  checkoutSessionId: string | null;
}) => Promise<string | null>;

interface EnrollmentCheckOptions {
  getAuthForRequest?: AuthForRequest;
  checkEnrollmentForUser?: EnrollmentCheck;
}

export type BillingPortalOwnershipResult =
  | { status: "ok"; customerId: string; purchaseId: string }
  | { status: "unauthenticated" | "forbidden" | "not_found" | "missing_customer" };

/**
 * Pure helper: given a list of purchase rows, is any one active?
 * Testable without a DB or Clerk.
 */
export function isEnrolled(
  purchases: Array<{ entitlement_status: string; refund_status: string }>,
): boolean {
  return purchases.some(
    (p) => p.entitlement_status === "active" && p.refund_status === "none",
  );
}

/**
 * Resolve enrollment status for a Clerk userId.
 * Throws on Clerk or DB failure — caller maps to 502 / 500.
 */
export async function checkEnrollment(
  userId: string,
  db: DbPool,
): Promise<EnrollmentResult> {
  const email = await resolveClerkEmail(userId);
  if (!email) return { studentId: null, enrolled: false };
  const result = await ensureComplimentaryEnrollment(
    { userId, email },
    { db: { connect: () => db.connect() } },
  );
  return { studentId: result.studentId, enrolled: result.enrolled };
}

/**
 * Returns an Express middleware array [clerkMiddleware(), enrollmentCheck].
 * Spread into route definitions:
 *   app.post("/api/drills/start", ...requireEnrollment(), handler)
 *
 * On success: attaches res.locals.enrolledStudentId (string) and calls next().
 * On failure: 401 (no session), 403 (not enrolled), 502 (Clerk/DB error).
 */
export function createEnrollmentCheckHandler(
  options: EnrollmentCheckOptions = {},
): RequestHandler {
  const getAuthForRequest = options.getAuthForRequest ?? getAuth;
  const checkEnrollmentForUser =
    options.checkEnrollmentForUser ??
    ((userId: string): Promise<EnrollmentResult> => checkEnrollment(userId, getPool()));

  const checkHandler: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { userId } = getAuthForRequest(req);
    if (!userId) {
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    try {
      const result = await checkEnrollmentForUser(userId);
      if (!result.enrolled) {
        res.status(403).json({ error: "enrollment required" });
        return;
      }
      res.locals.enrolledStudentId = result.studentId;
      next();
    } catch (err) {
      console.error("[requireEnrollment] lookup failed:", err);
      res.status(502).json({ error: "auth provider lookup failed" });
    }
  };
  return checkHandler;
}

export async function resolveOwnedBillingPortalCustomer(
  input: {
    studentId: unknown;
    checkoutSessionId?: string | null;
  },
  db: Pick<DbPool, "query"> = getPool(),
  recoverMissingCustomer?: MissingBillingCustomerResolver,
): Promise<BillingPortalOwnershipResult> {
  if (typeof input.studentId !== "string" || input.studentId.length === 0) {
    return { status: "unauthenticated" };
  }

  const checkoutSessionId =
    typeof input.checkoutSessionId === "string" &&
    input.checkoutSessionId.trim().length > 0
      ? input.checkoutSessionId.trim()
      : null;

  if (checkoutSessionId) {
    const { rows } = await db.query<BillingPortalPurchaseRow>(
      `SELECT purchase_id, student_id, stripe_customer_id, stripe_checkout_session_id,
              entitlement_status, refund_status
         FROM purchases
        WHERE stripe_checkout_session_id = $1
        LIMIT 1`,
      [checkoutSessionId],
    );
    const row = rows[0];
    if (!row) return { status: "not_found" };
    if (row.student_id !== input.studentId) return { status: "forbidden" };
    return ownedPortalCustomerFromPurchase(row, recoverMissingCustomer);
  }

  const { rows } = await db.query<BillingPortalPurchaseRow>(
    `SELECT purchase_id, student_id, stripe_customer_id, stripe_checkout_session_id,
            entitlement_status, refund_status
       FROM purchases
      WHERE student_id = $1
        AND entitlement_status = 'active'
        AND refund_status = 'none'
      ORDER BY (stripe_customer_id IS NOT NULL AND stripe_customer_id <> '') DESC,
               created_at DESC
      LIMIT 1`,
    [input.studentId],
  );
  const row = rows[0];
  return row
    ? ownedPortalCustomerFromPurchase(row, recoverMissingCustomer)
    : { status: "not_found" };
}

async function ownedPortalCustomerFromPurchase(
  row: BillingPortalPurchaseRow,
  recoverMissingCustomer?: MissingBillingCustomerResolver,
): Promise<BillingPortalOwnershipResult> {
  if (!isEnrolled([row])) return { status: "forbidden" };
  if (!row.stripe_customer_id) {
    const recoveredCustomerId = await recoverMissingCustomer?.({
      purchaseId: row.purchase_id,
      checkoutSessionId: row.stripe_checkout_session_id,
    });
    if (!recoveredCustomerId) return { status: "missing_customer" };
    return {
      status: "ok",
      customerId: recoveredCustomerId,
      purchaseId: row.purchase_id,
    };
  }
  return {
    status: "ok",
    customerId: row.stripe_customer_id,
    purchaseId: row.purchase_id,
  };
}

export function requireEnrolledResourceOwner(
  res: Response,
  resourceStudentId: string | null | undefined,
): boolean {
  if (
    typeof res.locals.enrolledStudentId === "string" &&
    resourceStudentId === res.locals.enrolledStudentId
  ) {
    return true;
  }
  res.status(403).json({ error: "resource forbidden" });
  return false;
}

export function requireEnrollment(): RequestHandler[] {
  return [clerkMiddleware(), createEnrollmentCheckHandler()];
}
