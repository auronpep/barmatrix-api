// Clerk -> student identity bridge.
//
// Shared by the authenticated "my data" routes (routes/me.ts) and the
// attempt-recording route (routes/attempts.ts). The whole point of this module
// is that the student is resolved SERVER-SIDE from the Clerk session — never
// from a client-supplied id — so a signed-in student's drill attempts attribute
// to their own red-zone history without letting anyone enumerate other students.

import { clerkClient } from "@clerk/express";
import type { DbClient, DbPool } from "../db.js";

/**
 * Lowercase + trim a raw email address. Returns null when blank or non-string.
 * Pure — unit tested without Clerk or a DB.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Resolve the primary email address for a Clerk user id.
 * Throws if the Clerk lookup fails (caller maps that to a 502).
 */
export async function resolveClerkEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  return normalizeEmail(user.primaryEmailAddress?.emailAddress);
}

/**
 * Return the student_id for an email, creating a 'registered' student row if
 * none exists yet. A signed-in student (enrolled or not) thereby accrues their
 * own attempt history, which is what makes the dashboard / red-zone loop close.
 *
 * Never downgrades an existing row's status — the INSERT is a no-op on the
 * unique email key, mirroring the anonymous-student pattern in routes/attempts.
 * Accepts a pooled connection (to run inside a transaction) or the pool itself.
 */
export async function findOrCreateStudentByEmail(
  db: DbClient | DbPool,
  email: string,
): Promise<string> {
  const existing = await db.query<{ student_id: string }>(
    "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
    [email],
  );
  const found = existing.rows[0]?.student_id;
  if (found) return found;

  await db.query(
    `INSERT INTO students (email, full_name, status, consent_flags)
          VALUES ($1, NULL, 'registered', JSON_OBJECT())
     ON DUPLICATE KEY UPDATE status = status`,
    [email],
  );

  const after = await db.query<{ student_id: string }>(
    "SELECT student_id FROM students WHERE email = $1 LIMIT 1",
    [email],
  );
  const resolved = after.rows[0]?.student_id;
  if (!resolved) {
    throw new Error(`failed to resolve student row for email ${email}`);
  }
  return resolved;
}
