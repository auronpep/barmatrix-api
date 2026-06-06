// Claim an anonymous diagnostic session's attempts for a newly-enrolled student.
//
// Anonymous diagnostic takers have their answers stored in student_attempts
// keyed by set_id = the diagnostic id, attached to a synthetic anonymous student
// (anon-<set_id>@barmatrix.local) with red-zone derivation skipped. When that
// person enrolls we want their Red-Zone Map waiting on day one instead of an
// empty dashboard. This re-points those attempts onto the real student and
// rebuilds the derived user_red_zones rows.
//
// Best-effort: callers run this AFTER the enrollment transaction has committed
// and never let a failure here surface — claiming is a bonus, never a blocker on
// the money path. Idempotent: a second run claims 0 rows because the attempts
// already belong to the student.

import type Stripe from "stripe";
import { getPool, type DbClient, type DbPool } from "../db.js";
import {
  QUESTION_DIMENSION_COLUMNS,
  upsertColumnDerivedRedZone,
} from "./redzones.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClaimResult {
  claimedAttempts: number;
  claimedSessions: number;
}

interface ClaimDeps {
  pool?: Pick<DbPool, "connect" | "query">;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Re-point one diagnostic session's attempts (set_id) onto a real student and
 * rebuild the derived red-zone rows. Must run inside a transaction so the
 * red-zone recompute reads the re-pointed attempts.
 *
 * @returns the number of attempts claimed (0 if the session was already owned).
 */
export async function claimDiagnosticAttempts(
  client: DbClient,
  studentId: string,
  diagnosticId: string,
): Promise<number> {
  const update = await client.query(
    `UPDATE student_attempts
        SET student_id = $1
      WHERE set_id = $2 AND student_id <> $1`,
    [studentId, diagnosticId],
  );
  const claimed = update.rowCount ?? 0;
  if (claimed === 0) return 0;

  // Rebuild derived red zones for every dimension value present in the set.
  const { rows } = await client.query<{
    subject: string | null;
    subtopic: string | null;
    tension_point: string | null;
  }>(
    `SELECT DISTINCT q.subject, q.subtopic, q.tension_point
       FROM student_attempts a
       JOIN questions q ON q.question_id = a.question_id
      WHERE a.set_id = $1`,
    [diagnosticId],
  );
  const seen = new Set<string>();
  for (const row of rows) {
    for (const { dimension, column } of QUESTION_DIMENSION_COLUMNS) {
      const value = row[column];
      if (!value) continue;
      const key = `${dimension}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await upsertColumnDerivedRedZone(
        client,
        studentId,
        dimension,
        column,
        value,
      );
    }
  }
  return claimed;
}

/**
 * Gather every diagnostic id worth claiming for a freshly-enrolled student: the
 * id carried through checkout metadata, plus any diagnostic_leads rows matching
 * the buyer email (covers cross-device: quiz on phone, bought on laptop).
 */
export async function collectClaimableDiagnosticIds(
  db: Pick<DbPool, "query">,
  email: string | null,
  metadataDiagnosticId: string | null,
): Promise<string[]> {
  const ids = new Set<string>();
  if (isUuid(metadataDiagnosticId)) ids.add(metadataDiagnosticId);
  if (email) {
    try {
      const { rows } = await db.query<{ diagnostic_id: string | null }>(
        `SELECT diagnostic_id FROM diagnostic_leads
          WHERE email = $1 AND diagnostic_id IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 10`,
        [email],
      );
      for (const r of rows) if (isUuid(r.diagnostic_id)) ids.add(r.diagnostic_id);
    } catch {
      // diagnostic_leads self-creates on first lead capture; absence is fine.
    }
  }
  return [...ids];
}

/**
 * Claim the diagnostic(s) attached to a completed checkout session for the
 * student it enrolled. Safe to call after fulfillment from both the webhook and
 * the manual recovery endpoint. Never throws — returns zeros on any failure.
 */
export async function claimDiagnosticForSession(
  input: {
    session: Stripe.Checkout.Session;
    studentId: string | undefined | null;
  },
  deps: ClaimDeps = {},
): Promise<ClaimResult> {
  const studentId = input.studentId;
  if (!studentId) return { claimedAttempts: 0, claimedSessions: 0 };
  const pool = deps.pool ?? getPool();
  const logger = deps.logger ?? console;
  const email =
    input.session.customer_details?.email?.toLowerCase().trim() ?? null;
  const metadataDiagnosticId = input.session.metadata?.diagnostic_id ?? null;

  let ids: string[];
  try {
    ids = await collectClaimableDiagnosticIds(pool, email, metadataDiagnosticId);
  } catch (err) {
    logger.error(`[claim-diagnostic] id lookup failed: ${String(err)}`);
    return { claimedAttempts: 0, claimedSessions: 0 };
  }
  if (ids.length === 0) return { claimedAttempts: 0, claimedSessions: 0 };

  let claimedAttempts = 0;
  let claimedSessions = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of ids) {
      const n = await claimDiagnosticAttempts(client, studentId, id);
      if (n > 0) {
        claimedAttempts += n;
        claimedSessions += 1;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error(
      `[claim-diagnostic] failed for student=${studentId}: ${String(err)}`,
    );
    return { claimedAttempts: 0, claimedSessions: 0 };
  } finally {
    client.release();
  }

  if (claimedSessions > 0) {
    logger.log(
      `[claim-diagnostic] student=${studentId} claimed ${claimedAttempts} attempt(s) across ${claimedSessions} session(s)`,
    );
  }
  return { claimedAttempts, claimedSessions };
}
