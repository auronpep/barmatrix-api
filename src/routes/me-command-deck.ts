// Authenticated "command-deck" dashboard data — a denser, live view of the
// student's repair state for the /preview/dashboard surface. This is a NEW
// endpoint; the live GET /api/me/dashboard (routes/me.ts) is intentionally left
// untouched so the production dashboard cannot regress.
//
//   GET /api/me/command-deck
//
// Auth: @clerk/express clerkMiddleware scoped to this route. The student is
// resolved SERVER-SIDE from the Clerk email (lib/me-student.ts); never from a
// client-supplied id. All queries are read-only.

import type { Express, Request, RequestHandler, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { snakeToTitle, kebabToTitle } from "../lib/format.js";
import {
  resolveClerkStudent,
  type StudentResolution,
} from "../lib/me-student.js";
import {
  daysToExam,
  SESSION_GOAL_MIN,
  computeStreak,
  shapeSubjectMastery,
  shapeCoverage,
  buildTensionMatrix,
  type SubjectMasteryRow,
  type HeatRow,
} from "../lib/command-deck.js";

const ACTIVE_RED_ZONE_THRESHOLD = 0.7;
const RECENT_ATTEMPTS_LIMIT = 8;
const RED_ZONE_LIMIT = 5;
const QUEUE_LIMIT = 3;

interface RegisterCommandDeckDeps {
  authMiddleware?: RequestHandler;
  resolveStudent?: (req: Request) => Promise<StudentResolution>;
  now?: () => Date;
}

interface NameRow {
  full_name: string | null;
}
interface DayRow {
  d: string;
  secs: number | string | null;
  n: number;
}
interface MasteryQueryRow {
  subject: string;
  att_recent: number | string;
  cor_recent: number | string;
  att_prior: number | string;
  cor_prior: number | string;
}
interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: number | string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}
interface TrendRow {
  day: string;
  attempts: number | string;
  pct: number | string;
}
interface CoverageQueryRow {
  covered: number | string | null;
  bank_total: number | string | null;
}
interface AttemptRow {
  attempt_id: string;
  question_id: string;
  selected_letter: string | null;
  correct: number | boolean;
  attempted_at: Date | string;
  subject: string | null;
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

// --- local helpers (mirrors the per-file private copies elsewhere) ---
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

function isTrue(v: number | boolean): boolean {
  return v === true || v === 1;
}

function trapNameFrom(forensicTags: unknown, subtopic: string | null): string {
  const tag = asStringArray(forensicTags).find((t) => t && t !== "correct_answer");
  if (tag) return `${snakeToTitle(tag)} trap`;
  if (subtopic) return `${subtopic} trap`;
  return "Wrong-answer trap";
}

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function drillSubject(d: DrillRow): string {
  if (d.red_zone_dimension === "subject" && d.red_zone_tag) return d.red_zone_tag;
  if (d.red_zone_dimension) return snakeToTitle(d.red_zone_dimension);
  return "Mixed";
}

function drillTitle(d: DrillRow): string {
  return d.drill_slug ? kebabToTitle(d.drill_slug) : d.reason;
}

export function registerCommandDeckRoutes(
  app: Express,
  deps: RegisterCommandDeckDeps = {},
): void {
  const authMiddleware = deps.authMiddleware ?? clerkMiddleware();
  const resolveStudent = deps.resolveStudent ?? resolveClerkStudent;
  const nowFn = deps.now ?? (() => new Date());

  app.get(
    "/api/me/command-deck",
    authMiddleware,
    async (req: Request, res: Response) => {
      const resolution = await resolveStudent(req);

      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }

      const emptyStudent = {
        first_name: "there",
        days_to_exam: daysToExam(nowFn()),
        streak_days: 0,
        session_done_min: 0,
        session_goal_min: SESSION_GOAL_MIN,
      };
      if (resolution.kind === "not_enrolled") {
        res.json({
          enrolled: false,
          status: null,
          student: emptyStudent,
          subject_mastery: [],
          coverage: { covered: 0, bank_total: 0, pct: 0 },
          red_zones: [],
          mastery_trend: [],
          recent_attempts: [],
          next_up: null,
          queue: [],
          tension_matrix: null,
        });
        return;
      }

      const student = resolution.student;
      const studentId = student.student_id;
      const now = nowFn();

      try {
        const pool = getPool();
        const [nameRes, dayRes, masteryRes, rzRes, trendRes, atRes, drRes, covRes] =
          await Promise.all([
            pool.query<NameRow>(
              "SELECT full_name FROM students WHERE student_id = $1 LIMIT 1",
              [studentId],
            ),
            pool.query<DayRow>(
              `SELECT DATE_FORMAT(attempted_at, '%Y-%m-%d') AS d,
                      SUM(time_seconds) AS secs, COUNT(*) AS n
                 FROM student_attempts
                WHERE student_id = $1
                  AND attempted_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                GROUP BY DATE_FORMAT(attempted_at, '%Y-%m-%d')
                ORDER BY d DESC`,
              [studentId],
            ),
            pool.query<MasteryQueryRow>(
              `SELECT q.subject,
                      SUM(CASE WHEN a.attempted_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                               THEN 1 ELSE 0 END) AS att_recent,
                      SUM(CASE WHEN a.attempted_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                                AND a.correct = 1 THEN 1 ELSE 0 END) AS cor_recent,
                      SUM(CASE WHEN a.attempted_at <  DATE_SUB(NOW(), INTERVAL 14 DAY)
                               THEN 1 ELSE 0 END) AS att_prior,
                      SUM(CASE WHEN a.attempted_at <  DATE_SUB(NOW(), INTERVAL 14 DAY)
                                AND a.correct = 1 THEN 1 ELSE 0 END) AS cor_prior
                 FROM student_attempts a
                 JOIN questions q ON q.question_id = a.question_id
                WHERE a.student_id = $1
                  AND a.attempted_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
                  AND q.subject IS NOT NULL
                GROUP BY q.subject`,
              [studentId],
            ),
            pool.query<RedZoneRow>(
              `SELECT dimension, tag_value, proficiency_score,
                      attempts_count, high_confidence_wrong_count
                 FROM user_red_zones
                WHERE student_id = $1
                ORDER BY proficiency_score ASC
                LIMIT ${RED_ZONE_LIMIT}`,
              [studentId],
            ),
            pool.query<TrendRow>(
              `SELECT DATE_FORMAT(attempted_at, '%Y-%m-%d') AS day,
                      COUNT(*) AS attempts,
                      ROUND(SUM(correct) * 100.0 / COUNT(*)) AS pct
                 FROM student_attempts
                WHERE student_id = $1
                  AND attempted_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                GROUP BY DATE_FORMAT(attempted_at, '%Y-%m-%d')
                ORDER BY day ASC`,
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
                LIMIT ${RECENT_ATTEMPTS_LIMIT}`,
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
            pool.query<CoverageQueryRow>(
              `SELECT
                 (SELECT COUNT(DISTINCT a.question_id)
                    FROM student_attempts a
                    JOIN questions q ON q.question_id = a.question_id
                   WHERE a.student_id = $1 AND q.status = 'active') AS covered,
                 (SELECT COUNT(*) FROM questions WHERE status = 'active') AS bank_total`,
              [studentId],
            ),
          ]);

        // --- student / today ---
        const days = dayRes.rows.map((r) => String(r.d));
        const todayIso = nowToIso(now);
        const todaySecs = num(dayRes.rows.find((r) => String(r.d) === todayIso)?.secs);
        const firstName =
          String(nameRes.rows[0]?.full_name ?? "").trim().split(/\s+/)[0] || "there";

        // --- bank coverage (lifetime distinct active questions attempted) ---
        const covRow = covRes.rows[0];
        const coverage = shapeCoverage(
          num(covRow?.covered),
          num(covRow?.bank_total),
        );

        // --- subject mastery ---
        const masteryRows: SubjectMasteryRow[] = masteryRes.rows.map((r) => ({
          subject: r.subject,
          att_recent: num(r.att_recent),
          cor_recent: num(r.cor_recent),
          att_prior: num(r.att_prior),
          cor_prior: num(r.cor_prior),
        }));

        // --- drills grouped per (dimension, tag) for red-zone progress ---
        const drillsByZone = new Map<string, { total: number; complete: number }>();
        for (const d of drRes.rows) {
          const key = `${d.red_zone_dimension ?? ""}::${d.red_zone_tag ?? ""}`;
          const cur = drillsByZone.get(key) ?? { total: 0, complete: 0 };
          cur.total += 1;
          if (d.status === "completed") cur.complete += 1;
          drillsByZone.set(key, cur);
        }

        // --- red zones (ranked) ---
        const redZones = rzRes.rows.map((r, i) => {
          const prof = num(r.proficiency_score);
          const attempts = num(r.attempts_count);
          const missApprox = Math.max(0, attempts - Math.round(prof * attempts));
          const zoneKey = `${r.dimension}::${r.tag_value}`;
          const drills = drillsByZone.get(zoneKey) ?? { total: 0, complete: 0 };
          return {
            rank: i + 1,
            name: snakeToTitle(r.tag_value),
            subject:
              r.dimension === "subject" ? r.tag_value : snakeToTitle(r.dimension),
            dimension: r.dimension,
            tag: r.tag_value,
            miss_count: missApprox,
            total_attempts: attempts,
            drills_total: drills.total,
            drills_complete: drills.complete,
            trend: "flat" as const, // no stored prior signal yet
            last_missed: "",
            active: prof < ACTIVE_RED_ZONE_THRESHOLD,
          };
        });

        // --- mastery trend ---
        const masteryTrend = trendRes.rows.map((r) => ({
          day: String(r.day),
          pct: num(r.pct),
          attempts: num(r.attempts),
        }));

        // --- recent attempts (identical shape to /api/me/dashboard) ---
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

        // --- next up + queue from assigned drills ---
        const queue = drRes.rows.slice(0, QUEUE_LIMIT).map((d) => ({
          drill_slug: d.drill_slug ?? "",
          title: drillTitle(d),
          subject: drillSubject(d),
          reason: d.reason,
          question_count: 0, // not known from an assignment row
          est_min: 0,
        }));
        const nextUp = queue[0] ?? null;

        // --- tension matrix (guarded; JSON_TABLE may be unsupported) ---
        let tensionMatrix: ReturnType<typeof buildTensionMatrix> | null = null;
        try {
          const { rows: heatRows } = await pool.query<HeatRow>(
            `SELECT q.subject, jt.slug AS trap_slug, COUNT(*) AS miss_count
               FROM student_attempts a
               JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
               JOIN questions q ON q.question_id = a.question_id
               JOIN JSON_TABLE(ac.forensic_tags, '$[*]'
                      COLUMNS (slug VARCHAR(255) PATH '$')) jt
              WHERE a.student_id = $1 AND a.correct = 0
                AND q.subject IS NOT NULL
                AND a.attempted_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
              GROUP BY q.subject, jt.slug`,
            [studentId],
          );
          const normalized: HeatRow[] = heatRows.map((r) => ({
            subject: r.subject,
            trap_slug: String((r as { trap_slug: unknown }).trap_slug ?? ""),
            miss_count: num((r as { miss_count: number | string }).miss_count),
          }));
          tensionMatrix = buildTensionMatrix(normalized);
        } catch (err) {
          // Graceful degrade: old MariaDB without JSON_TABLE, or no choices joined.
          console.warn("[command-deck] tension matrix unavailable:", err);
          tensionMatrix = null;
        }

        res.json({
          enrolled: student.enrolled,
          status: student.status,
          student: {
            first_name: firstName,
            days_to_exam: daysToExam(now),
            streak_days: computeStreak(days, now),
            session_done_min: Math.round(todaySecs / 60),
            session_goal_min: SESSION_GOAL_MIN,
          },
          subject_mastery: shapeSubjectMastery(masteryRows),
          coverage,
          red_zones: redZones,
          mastery_trend: masteryTrend,
          recent_attempts: recentAttempts,
          next_up: nextUp,
          queue,
          tension_matrix: tensionMatrix,
        });
      } catch (err) {
        console.error("[me command-deck] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}

function nowToIso(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
