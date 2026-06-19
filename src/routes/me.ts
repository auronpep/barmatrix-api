// Authenticated "my data" routes — the Clerk -> student bridge that powers the
// paid dashboard.
//
//   GET /api/me/entitlement — lightweight enrollment check for CTA gating.
//   GET /api/me/dashboard   — aggregate dashboard payload (metrics, red zones,
//                             recent forensics, assigned drills).
//
// Auth: @clerk/express clerkMiddleware, scoped to these routes (never global,
// so the Stripe webhook raw-body path and public funnel are untouched). The
// student is resolved SERVER-SIDE from the Clerk email — never from a
// client-supplied id — so one student can't read another's data.

import type { Express, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { clerkMiddleware, getAuth } from "@clerk/express";
import Stripe from "stripe";
import { getPool, type DbPool } from "../db.js";
import { snakeToTitle, kebabToTitle } from "../lib/format.js";
import { readGamification } from "../lib/gamification-store.js";
import { BADGE_CATALOG, levelFromXp, type BadgeSlug } from "../lib/gamification.js";
import { resolveClerkEmail } from "../lib/clerk-identity.js";
import { fulfillCheckoutSession } from "../entitlement.js";
import { claimDiagnosticForSession, collectClaimableDiagnosticIds } from "../lib/claim-diagnostic.js";
import { routeFromSessionAttemptCounts } from "../lib/checkout-next-step.js";
import { config } from "../config.js";
import { validateCheckoutSessionForRecovery } from "../checkout.js";
import { armTwoPaySubscription } from "../lib/two-pay.js";

const MAX_ZONES_PER_DIMENSION = 5;
const ACTIVE_RED_ZONE_THRESHOLD = 0.7;

interface StudentRow {
  student_id: string;
  status: string;
}
interface EntitlementRow {
  entitlement_status: string;
  refund_status: string;
  stripe_customer_id?: string | null;
  stripe_checkout_session_id?: string | null;
  payment_plan?: string | null;
}
interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}
interface RedZoneMetricsRow {
  active_red_zones: number | string;
  high_confidence_wrongs: number | string;
  avg_proficiency_score: number | string | null;
}
interface AttemptRow {
  attempt_id: string;
  question_id: string;
  selected_letter: string | null;
  correct: number | boolean;
  attempted_at: Date | string;
  subject: string;
  subtopic: string | null;
  forensic_tags: unknown;
}
interface DrillRow {
  assignment_id: string;
  drill_slug: string | null;
  reason: string;
  red_zone_dimension: string | null;
  red_zone_tag: string | null;
  status: string;
  prescribed_at: Date | string;
}

function asStringArray(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function trapNameFrom(forensicTags: unknown, subtopic: string | null): string {
  const tag = asStringArray(forensicTags).find((t) => t && t !== "correct_answer");
  if (tag) return `${snakeToTitle(tag)} trap`;
  if (subtopic) return `${subtopic} trap`;
  return "Wrong-answer trap";
}

function isTrue(v: number | boolean): boolean {
  return v === true || v === 1;
}

function billingPortalCapability(row: EntitlementRow | undefined) {
  const active =
    row?.entitlement_status === "active" && row.refund_status === "none";
  if (!active) {
    return {
      portal_available: false,
      unavailable_reason: "not_enrolled",
    };
  }

  if (row.stripe_customer_id && row.stripe_customer_id.trim().length > 0) {
    return {
      portal_available: true,
      unavailable_reason: null,
    };
  }

  const checkoutSessionId = row.stripe_checkout_session_id?.trim() ?? "";
  const manualOrComplimentary =
    row.payment_plan === "complimentary" ||
    checkoutSessionId.length === 0 ||
    checkoutSessionId.startsWith("comp_");

  return {
    portal_available: false,
    unavailable_reason: manualOrComplimentary
      ? "manual_or_complimentary"
      : "stripe_customer_missing",
  };
}

function isMissingGamificationTableError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

function emptyGamificationProfile() {
  return {
    total_xp: 0,
    current_streak: 0,
    longest_streak: 0,
    level: levelFromXp(0),
    badges: [] as unknown[],
  };
}

async function readDashboardGamification(pool: DbPool, studentId: string) {
  try {
    const profile = await readGamification(pool, studentId);
    return {
      total_xp: profile.total_xp,
      current_streak: profile.current_streak,
      longest_streak: profile.longest_streak,
      level: levelFromXp(profile.total_xp),
      badges: profile.badges.map((b) => {
        const meta = BADGE_CATALOG[b.slug as BadgeSlug];
        return {
          slug: b.slug,
          label: meta?.label ?? b.slug,
          description: meta?.description ?? "",
          emoji: meta?.emoji ?? "🏅",
          earned_at: b.earned_at,
        };
      }),
    };
  } catch (err) {
    if (!isMissingGamificationTableError(err)) throw err;
    return emptyGamificationProfile();
  }
}

// Best-effort post-checkout routing signal. Reads the diagnostic ids tied to a
// checkout session (Stripe metadata id + email-matched leads), counts attempts
// per diagnostic session, and decides foundations-vs-diagnostic. Any failure
// degrades to "diagnostic" so a paying customer is never left without a next step.
async function resolveCheckoutRouting(sessionId: string) {
  const safeDefault = { diagnostic_completed: false, next_step: "diagnostic" as const };
  try {
    const stripe = new Stripe(config.stripe.secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email =
      session.customer_details?.email?.toLowerCase().trim() ?? null;
    const metadataDiagnosticId = session.metadata?.diagnostic_id ?? null;

    const pool = getPool();
    const ids = await collectClaimableDiagnosticIds(
      pool,
      email,
      metadataDiagnosticId,
    );
    if (ids.length === 0) return safeDefault;

    const placeholders = ids.map((_id, index) => `$${index + 1}`).join(", ");
    const { rows } = await pool.query<{ set_id: string; n: number | string }>(
      `SELECT set_id, COUNT(*) AS n
         FROM student_attempts
        WHERE set_id IN (${placeholders})
        GROUP BY set_id`,
      ids,
    );
    const countsById = new Map(rows.map((row) => [row.set_id, Number(row.n)]));
    const counts = ids.map((id) => countsById.get(id) ?? 0);
    return routeFromSessionAttemptCounts(counts);
  } catch (err) {
    console.error("[checkout status] routing resolve failed:", err);
    return safeDefault;
  }
}

export function registerMeRoutes(app: Express): void {
  app.get(
    "/api/me/entitlement",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      let email: string | null;
      try {
        email = await resolveClerkEmail(userId);
      } catch (err) {
        console.error("[me entitlement] clerk lookup failed:", err);
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (!email) {
        res.json({ enrolled: false, status: null, refunded: false });
        return;
      }
      try {
        const { rows } = await getPool().query<EntitlementRow>(
          `SELECT p.entitlement_status, p.refund_status
             FROM purchases p
             JOIN students s ON s.student_id = p.student_id
            WHERE s.email = $1
            ORDER BY (p.entitlement_status = 'active' AND p.refund_status = 'none') DESC
            LIMIT 1`,
          [email],
        );
        const row = rows[0];
        const status = row?.entitlement_status ?? null;
        const refunded = row ? row.refund_status !== "none" : false;
        res.json({ enrolled: status === "active" && !refunded, status, refunded });
      } catch (err) {
        console.error("[me entitlement] db lookup failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.get(
    "/api/me/dashboard",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }

      let email: string | null;
      try {
        email = await resolveClerkEmail(userId);
      } catch (err) {
        console.error("[me dashboard] clerk lookup failed:", err);
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }

      const empty = {
        enrolled: false,
        status: null as string | null,
        refunded: false,
        student_id: null as string | null,
        billing_portal: billingPortalCapability(undefined),
        metrics: { repair_progress_pct: 0, active_red_zones: 0, high_confidence_wrongs: 0 },
        red_zones: { by_dimension: {} as Record<string, unknown[]> },
        recent_attempts: [] as unknown[],
        assigned_drills: [] as unknown[],
        gamification: emptyGamificationProfile(),
      };
      if (!email) {
        res.json(empty);
        return;
      }

      try {
        const pool = getPool();
        const { rows: studentRows } = await pool.query<StudentRow>(
          "SELECT student_id, status FROM students WHERE email = $1 LIMIT 1",
          [email],
        );
        const student = studentRows[0];
        if (!student) {
          res.json(empty);
          return;
        }
        const studentId = student.student_id;

        const [entRes, rzRes, rzMetricsRes, atRes, drRes, gamification] = await Promise.all([
          pool.query<EntitlementRow>(
            `SELECT entitlement_status, refund_status,
                    stripe_customer_id, stripe_checkout_session_id, payment_plan
               FROM purchases
              WHERE student_id = $1
              ORDER BY (entitlement_status = 'active' AND refund_status = 'none') DESC,
                       (stripe_customer_id IS NOT NULL AND stripe_customer_id <> '') DESC,
                       created_at DESC
              LIMIT 1`,
            [studentId],
          ),
          pool.query<RedZoneRow>(
            `SELECT dimension, tag_value, proficiency_score,
                    attempts_count, high_confidence_wrong_count
               FROM user_red_zones
              WHERE student_id = $1
              ORDER BY dimension ASC, proficiency_score ASC
              LIMIT 50`,
            [studentId],
          ),
          pool.query<RedZoneMetricsRow>(
            `SELECT COALESCE(SUM(CASE WHEN proficiency_score < ${ACTIVE_RED_ZONE_THRESHOLD} THEN 1 ELSE 0 END), 0) AS active_red_zones,
                    COALESCE(SUM(high_confidence_wrong_count), 0) AS high_confidence_wrongs,
                    AVG(proficiency_score) AS avg_proficiency_score
               FROM user_red_zones
              WHERE student_id = $1`,
            [studentId],
          ),
          pool.query<AttemptRow>(
            `SELECT a.attempt_id, a.question_id, a.selected_letter, a.correct,
                    a.attempted_at, q.subject, q.subtopic, ac.forensic_tags
               FROM student_attempts a
               JOIN questions q ON q.question_id = a.question_id
               LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
              WHERE a.student_id = $1
              ORDER BY a.attempted_at DESC
              LIMIT 8`,
            [studentId],
          ),
          pool.query<DrillRow>(
            `SELECT assignment_id, drill_slug, reason, red_zone_dimension,
                    red_zone_tag, status, prescribed_at
               FROM drill_assignments
              WHERE student_id = $1
              ORDER BY prescribed_at DESC
              LIMIT 20`,
            [studentId],
          ),
          readDashboardGamification(pool, studentId),
        ]);

        const ent = entRes.rows[0];
        const status = ent?.entitlement_status ?? null;
        const refunded = ent ? ent.refund_status !== "none" : false;
        const enrolled = status === "active" && !refunded;

        const byDimension: Record<
          string,
          Array<{
            tag: string;
            proficiency_score: number;
            attempts: number;
            high_confidence_wrongs: number;
          }>
        > = {};
        const rzMetrics = rzMetricsRes.rows[0];
        const activeRedZones = Number(rzMetrics?.active_red_zones ?? 0);
        const highConfidenceWrongs = Number(rzMetrics?.high_confidence_wrongs ?? 0);
        const avgProficiency = rzMetrics?.avg_proficiency_score;
        const repairPct = avgProficiency == null ? 0 : Math.round(Number(avgProficiency) * 100);
        for (const r of rzRes.rows) {
          const prof = Number(r.proficiency_score);
          const list = byDimension[r.dimension] ?? [];
          if (list.length < MAX_ZONES_PER_DIMENSION) {
            list.push({
              tag: r.tag_value,
              proficiency_score: prof,
              attempts: r.attempts_count,
              high_confidence_wrongs: r.high_confidence_wrong_count,
            });
          }
          byDimension[r.dimension] = list;
        }

        const recentAttempts = atRes.rows.map((a) => {
          const correct = isTrue(a.correct);
          return {
            attempt_id: a.attempt_id,
            question_id: a.question_id,
            subject: a.subject,
            subtopic: a.subtopic,
            selected_letter: a.selected_letter,
            correct,
            trap_name: correct ? null : trapNameFrom(a.forensic_tags, a.subtopic),
            attempted_at: a.attempted_at,
          };
        });

        const assignedDrills = drRes.rows.map((d) => ({
          assignment_id: d.assignment_id,
          drill_slug: d.drill_slug,
          drill_name: d.drill_slug ? kebabToTitle(d.drill_slug) : d.reason,
          reason: d.reason,
          red_zone_dimension: d.red_zone_dimension,
          red_zone_tag: d.red_zone_tag,
          status: d.status,
          prescribed_at: d.prescribed_at,
        }));

        res.json({
          enrolled,
          status,
          refunded,
          student_id: studentId,
          billing_portal: billingPortalCapability(ent),
          metrics: {
            repair_progress_pct: repairPct,
            active_red_zones: activeRedZones,
            high_confidence_wrongs: highConfidenceWrongs,
          },
          red_zones: { by_dimension: byDimension },
          recent_attempts: recentAttempts,
          assigned_drills: assignedDrills,
          gamification,
        });
      } catch (err) {
        console.error("[me dashboard] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  // ---- Check if a checkout session has been fulfilled ----
  // Public endpoint — checks if a checkout session has been processed into a purchase.
  // Used by account page to detect if webhook failed.
  app.get("/api/checkout/:sessionId/status", async (req: Request, res: Response) => {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }

    try {
      const pool = getPool();
      const result = await pool.query<{
        purchase_id: string;
        entitlement_status: string;
      }>(
        `SELECT p.purchase_id, p.entitlement_status
         FROM purchases p
         WHERE p.stripe_checkout_session_id = $1
         LIMIT 1`,
        [sessionId],
      );

      const routing = await resolveCheckoutRouting(sessionId);

      if (result.rows.length > 0) {
        const purchase = result.rows[0]!;
        res.json({
          fulfilled: true,
          purchaseId: purchase.purchase_id,
          status: purchase.entitlement_status,
          diagnostic_completed: routing.diagnostic_completed,
          next_step: routing.next_step,
        });
      } else {
        res.json({
          fulfilled: false,
          diagnostic_completed: routing.diagnostic_completed,
          next_step: routing.next_step,
        });
      }
    } catch (err) {
      console.error("[checkout status] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ---- Recovery endpoint: manually fulfill a checkout session if webhook failed ----
  app.post("/api/checkout/:sessionId/recover", clerkMiddleware(), async (req: Request, res: Response) => {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }

    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      let requesterEmail: string | null;
      try {
        requesterEmail = await resolveClerkEmail(userId);
      } catch (err) {
        console.error("[checkout recover] clerk lookup failed:", err);
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (!requesterEmail) {
        res.status(403).json({ error: "checkout session owner mismatch" });
        return;
      }

      const stripe = new Stripe(config.stripe.secretKey);
      const pool = getPool();

      // Fetch the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) {
        res.status(404).json({ error: "checkout session not found in Stripe" });
        return;
      }
      const sessionEmail =
        session.customer_details?.email?.toLowerCase().trim() ?? null;
      if (!sessionEmail || sessionEmail !== requesterEmail) {
        res.status(403).json({ error: "checkout session owner mismatch" });
        return;
      }

      const validation = validateCheckoutSessionForRecovery(session);
      if (!validation.ok) {
        res.status(validation.httpStatus).json({ error: validation.error });
        return;
      }

      // Check if already fulfilled after authenticating ownership of the Stripe session.
      const existing = await pool.query<{ purchase_id: string }>(
        "SELECT purchase_id FROM purchases WHERE stripe_checkout_session_id = $1 LIMIT 1",
        [sessionId],
      );
      if (existing.rows.length > 0) {
        res.json({
          status: "already_fulfilled",
          purchaseId: existing.rows[0]?.purchase_id,
          message: "Checkout session was already processed",
        });
        return;
      }

      let subscriptionId: string | null = null;
      if (session.metadata?.payment_plan === "two_pay_500_499") {
        subscriptionId = await armTwoPaySubscription(session, stripe);
      } else if (typeof session.subscription === "string") {
        subscriptionId = session.subscription;
      } else if (
        session.subscription &&
        typeof session.subscription === "object"
      ) {
        subscriptionId = session.subscription.id;
      }

      // Manually fulfill the session
      const result = await fulfillCheckoutSession({
        session,
        subscriptionId,
      });

      // Best-effort: claim the buyer's anonymous diagnostic onto the recovered
      // student record (same as the webhook path). Never blocks recovery.
      try {
        await claimDiagnosticForSession({
          session,
          studentId: result.studentId,
        });
      } catch (err) {
        console.error("[checkout recover] diagnostic claim failed:", err);
      }

      res.json({
        status: result.status,
        purchaseId: result.purchaseId,
        studentId: result.studentId,
        seatNumber: result.seatNumber,
        message:
          result.status === "fulfilled"
            ? "Enrollment recovered successfully"
            : "Session was already processed",
      });
    } catch (err) {
      console.error("[checkout recover] failed:", err);
      Sentry.captureException(err, {
        tags: { area: "checkout_recover" },
        extra: { sessionId },
      });
      res.status(500).json({ error: "recovery failed" });
    }
  });
}
