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
import { clerkMiddleware, getAuth } from "@clerk/express";
import { getPool } from "../db.js";
import { snakeToTitle, kebabToTitle } from "../lib/format.js";
import { resolveClerkEmail } from "../lib/clerk-identity.js";

const MAX_ZONES_PER_DIMENSION = 5;
const ACTIVE_RED_ZONE_THRESHOLD = 0.7;

interface StudentRow {
  student_id: string;
  status: string;
}
interface EntitlementRow {
  entitlement_status: string;
  refund_status: string;
}
interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: string;
  attempts_count: number;
  high_confidence_wrong_count: number;
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
        metrics: { repair_progress_pct: 0, active_red_zones: 0, high_confidence_wrongs: 0 },
        red_zones: { by_dimension: {} as Record<string, unknown[]> },
        recent_attempts: [] as unknown[],
        assigned_drills: [] as unknown[],
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

        const [entRes, rzRes, atRes, drRes] = await Promise.all([
          pool.query<EntitlementRow>(
            `SELECT entitlement_status, refund_status
               FROM purchases
              WHERE student_id = $1
              ORDER BY (entitlement_status = 'active' AND refund_status = 'none') DESC
              LIMIT 1`,
            [studentId],
          ),
          pool.query<RedZoneRow>(
            `SELECT dimension, tag_value, proficiency_score,
                    attempts_count, high_confidence_wrong_count
               FROM user_red_zones
              WHERE student_id = $1
              ORDER BY dimension ASC, proficiency_score ASC`,
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
        let profSum = 0;
        let profCount = 0;
        let activeRedZones = 0;
        let highConfidenceWrongs = 0;
        for (const r of rzRes.rows) {
          const prof = Number(r.proficiency_score);
          profSum += prof;
          profCount += 1;
          if (prof < ACTIVE_RED_ZONE_THRESHOLD) activeRedZones += 1;
          highConfidenceWrongs += r.high_confidence_wrong_count;
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
        const repairPct = profCount > 0 ? Math.round((profSum / profCount) * 100) : 0;

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
          metrics: {
            repair_progress_pct: repairPct,
            active_red_zones: activeRedZones,
            high_confidence_wrongs: highConfidenceWrongs,
          },
          red_zones: { by_dimension: byDimension },
          recent_attempts: recentAttempts,
          assigned_drills: assignedDrills,
        });
      } catch (err) {
        console.error("[me dashboard] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}
