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

export interface EnrollmentResult {
  studentId: string | null;
  enrolled: boolean;
}

interface PurchaseRow {
  student_id: string;
  entitlement_status: string;
  refund_status: string;
}

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

  const { rows } = await db.query<PurchaseRow>(
    `SELECT s.student_id, p.entitlement_status, p.refund_status
       FROM students s
       JOIN purchases p ON p.student_id = s.student_id
      WHERE s.email = $1
      LIMIT 5`,
    [email],
  );

  if (rows.length > 0 && isEnrolled(rows)) {
    const activeRow = rows.find(
      (r) => r.entitlement_status === "active" && r.refund_status === "none",
    );
    return { studentId: activeRow!.student_id, enrolled: true };
  }

  // Student may exist but have no active purchase.
  const studentRes = await db.query<{ student_id: string }>(
    "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
    [email],
  );
  return {
    studentId: studentRes.rows[0]?.student_id ?? null,
    enrolled: false,
  };
}

/**
 * Returns an Express middleware array [clerkMiddleware(), enrollmentCheck].
 * Spread into route definitions:
 *   app.post("/api/drills/start", ...requireEnrollment(), handler)
 *
 * On success: attaches res.locals.enrolledStudentId (string) and calls next().
 * On failure: 401 (no session), 403 (not enrolled), 502 (Clerk/DB error).
 */
export function requireEnrollment(): RequestHandler[] {
  const checkHandler: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    try {
      const result = await checkEnrollment(userId, getPool());
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
  return [clerkMiddleware(), checkHandler];
}
