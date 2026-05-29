// Shared Clerk -> student resolver for authenticated "my data" routes.
//
// Server-derives the student from the signed-in Clerk session email; it never
// trusts a client-supplied id, so one student cannot read another's data. Used
// by the Red Zone Library routes. routes/me.ts keeps its own inline copy on
// purpose — that file is the live, deployed dashboard endpoint and is left
// untouched here.
//
// DB queries are intentionally NOT wrapped in try/catch: a DB failure should
// propagate to the calling route's handler so it returns a 500, mirroring the
// existing me.ts behavior. Only the Clerk lookup is caught (mapped to 502).

import type { Request } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { getPool } from "../db.js";

export interface ResolvedStudent {
  student_id: string;
  student_status: string;
  enrolled: boolean;
  status: string | null;
  refunded: boolean;
}

export type StudentResolution =
  | { kind: "unauthenticated" }
  | { kind: "clerk_error" }
  | { kind: "not_enrolled" }
  | { kind: "ok"; student: ResolvedStudent };

interface StudentRow {
  student_id: string;
  status: string;
}

interface EntitlementRow {
  entitlement_status: string;
  refund_status: string;
}

export async function resolveClerkStudent(
  req: Request,
): Promise<StudentResolution> {
  const { userId } = getAuth(req);
  if (!userId) return { kind: "unauthenticated" };

  let email: string | null;
  try {
    const user = await clerkClient.users.getUser(userId);
    email =
      user.primaryEmailAddress?.emailAddress?.toLowerCase().trim() ?? null;
  } catch (err) {
    console.error("[me-student] clerk lookup failed:", err);
    return { kind: "clerk_error" };
  }
  if (!email) return { kind: "not_enrolled" };

  const pool = getPool();
  const { rows: studentRows } = await pool.query<StudentRow>(
    "SELECT student_id, status FROM students WHERE email = $1 LIMIT 1",
    [email],
  );
  const student = studentRows[0];
  if (!student) return { kind: "not_enrolled" };

  const { rows: entRows } = await pool.query<EntitlementRow>(
    `SELECT entitlement_status, refund_status
       FROM purchases
      WHERE student_id = $1
      ORDER BY (entitlement_status = 'active' AND refund_status = 'none') DESC
      LIMIT 1`,
    [student.student_id],
  );
  const ent = entRows[0];
  const status = ent?.entitlement_status ?? null;
  const refunded = ent ? ent.refund_status !== "none" : false;
  const enrolled = status === "active" && !refunded;

  return {
    kind: "ok",
    student: {
      student_id: student.student_id,
      student_status: student.status,
      enrolled,
      status,
      refunded,
    },
  };
}
