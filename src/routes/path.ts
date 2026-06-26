// J7 Guided "Lead Me" Path — authenticated routes.
//
//   GET  /api/me/path                  → the single next task + progress + gamification
//   POST /api/me/path/:stepId/complete → validate the step's rule, record it, grant XP
//
// Student is resolved SERVER-SIDE from the Clerk session (never a client id), same
// model as routes/me*.ts. The path tables are founder-gated (SCHEMA_PATH_MYSQL.sql)
// and may be ABSENT in prod: missing-table errors degrade to "no progress yet" and
// the route still serves the first step (never a 500), mirroring foundations.ts.
//
// Completion is reconciled every request: a step counts as done if it has a
// student_path_progress row OR an existing live signal already satisfies it
// (foundations_progress / student_attempts by set_id / student_flashcard_reviews).
// This in-memory union fast-forwards students with prior activity WITHOUT writing
// backfill rows, so an explicit POST can still grant XP exactly once. self_declared
// steps (reads/reflections/celebrations) complete ONLY via POST.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import { grantBootCampActivity, readGamification } from "../lib/gamification-store.js";
import { BADGE_CATALOG, levelFromXp, type BadgeSlug } from "../lib/gamification.js";
import { PATH_STEPS, PATH_DAY_COUNT, PATH_VERSION } from "../lib/path.data.js";
import {
  buildPathSummary,
  computeCurrentDay,
  computeNextStep,
  isStepAvailable,
  signalSatisfiesStep,
  toPublicStep,
  type CompletionSignals,
  type PathState,
  type PathStep,
} from "../lib/path-engine.js";
import { readLeadMeCurrent } from "../lib/leadme-current-service.js";

// Quiz steps ship with empty question_ids (founder hand-pick pending). Clamp each
// quiz step's required count to the number of ids actually loaded so a short pick
// can't make a set permanently un-completable; an empty set stays unavailable.
const STEPS: PathStep[] = PATH_STEPS.map((s) => {
  if (
    s.kind === "quiz_set" &&
    s.target.kind === "quiz" &&
    s.completion_rule.kind === "quiz_attempts_count" &&
    s.target.question_ids.length > 0
  ) {
    return {
      ...s,
      completion_rule: {
        ...s.completion_rule,
        required: s.target.question_ids.length,
      },
    };
  }
  return s;
});

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

function unavailableStepIds(): Set<string> {
  const doctrinalApproved = process.env.DOCTRINAL_APPROVED === "1";
  const set = new Set<string>();
  for (const s of STEPS) {
    if (!isStepAvailable(s, { doctrinalApproved })) set.add(s.id);
  }
  return set;
}

async function loadProgressIds(studentId: string): Promise<Set<string>> {
  try {
    const { rows } = await getPool().query<{ step_id: string }>(
      `SELECT step_id FROM student_path_progress WHERE student_id = $1`,
      [studentId],
    );
    return new Set(rows.map((r) => r.step_id));
  } catch (err) {
    if (isMissingTableError(err)) return new Set();
    throw err;
  }
}

async function loadState(studentId: string): Promise<PathState> {
  const empty: PathState = {
    current_day: null,
    active_step_id: null,
    active_step_shown_at: null,
  };
  try {
    const { rows } = await getPool().query<{
      current_day: number;
      active_step_id: string | null;
      active_step_shown_at: Date | string | null;
    }>(
      `SELECT current_day, active_step_id, active_step_shown_at
         FROM student_path_state WHERE student_id = $1 LIMIT 1`,
      [studentId],
    );
    const r = rows[0];
    if (!r) return empty;
    return {
      current_day: Number(r.current_day),
      active_step_id: r.active_step_id,
      active_step_shown_at: r.active_step_shown_at
        ? new Date(r.active_step_shown_at)
        : null,
    };
  } catch (err) {
    if (isMissingTableError(err)) return empty;
    throw err;
  }
}

async function loadEnrollmentDate(studentId: string): Promise<Date> {
  const { rows } = await getPool().query<{ enrollment_date: Date | string | null }>(
    `SELECT COALESCE(
              (SELECT MIN(ce.enrolled_at) FROM cohort_enrollments ce WHERE ce.student_id = s.student_id),
              (SELECT MIN(p.created_at)   FROM purchases p          WHERE p.student_id  = s.student_id),
              s.created_at
            ) AS enrollment_date
       FROM students s WHERE s.student_id = $1 LIMIT 1`,
    [studentId],
  );
  const raw = rows[0]?.enrollment_date ?? null;
  return raw ? new Date(raw) : new Date();
}

async function loadSignals(studentId: string): Promise<CompletionSignals> {
  const pool = getPool();
  const signals: CompletionSignals = {
    foundationsCompleted: new Set(),
    quizAttemptCounts: new Map(),
    flashcardReviewCounts: new Map(),
  };

  try {
    const { rows } = await pool.query<{ lesson_slug: string }>(
      `SELECT lesson_slug FROM foundations_progress
        WHERE student_id = $1 AND status = 'completed'`,
      [studentId],
    );
    for (const r of rows) signals.foundationsCompleted.add(r.lesson_slug);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  const setIds = Array.from(
    new Set(
      STEPS.flatMap((s) =>
        s.completion_rule.kind === "quiz_attempts_count"
          ? [s.completion_rule.set_id]
          : [],
      ),
    ),
  );
  if (setIds.length > 0) {
    const placeholders = setIds.map((_v, i) => `$${i + 2}`).join(", ");
    const { rows } = await pool.query<{ set_id: string; n: number | string }>(
      `SELECT set_id, COUNT(DISTINCT question_id) AS n
         FROM student_attempts
        WHERE student_id = $1 AND set_id IN (${placeholders})
        GROUP BY set_id`,
      [studentId, ...setIds],
    );
    for (const r of rows) signals.quizAttemptCounts.set(r.set_id, Number(r.n));
  }

  try {
    const { rows } = await pool.query<{ deck_id: string; n: number | string }>(
      `SELECT deck_id, COUNT(DISTINCT card_id) AS n
         FROM student_flashcard_reviews
        WHERE student_id = $1
        GROUP BY deck_id`,
      [studentId],
    );
    for (const r of rows) signals.flashcardReviewCounts.set(r.deck_id, Number(r.n));
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  return signals;
}

/** Union of explicit completions and signal-derived completions. */
function unionCompleted(
  progressIds: Set<string>,
  signals: CompletionSignals,
  unavailable: Set<string>,
): Set<string> {
  const out = new Set(progressIds);
  for (const s of STEPS) {
    if (unavailable.has(s.id)) continue;
    if (out.has(s.id)) continue;
    if (signalSatisfiesStep(s, signals)) out.add(s.id);
  }
  return out;
}

async function upsertState(
  studentId: string,
  currentDay: number,
  activeStepId: string | null,
  shownAt: Date | null,
): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO student_path_state
         (student_id, current_day, active_step_id, active_step_shown_at)
       VALUES ($1, $2, $3, $4)
       ON DUPLICATE KEY UPDATE
         current_day = VALUES(current_day),
         active_step_id = VALUES(active_step_id),
         active_step_shown_at = VALUES(active_step_shown_at)`,
      [studentId, currentDay, activeStepId, shownAt],
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    // State table not provisioned: the path still serves the primary step; only
    // the 15-min fallback is unavailable until the migration runs.
  }
}

async function readGamificationSafe(studentId: string) {
  try {
    const g = await readGamification(getPool(), studentId);
    return {
      total_xp: g.total_xp,
      current_streak: g.current_streak,
      longest_streak: g.longest_streak,
      level: levelFromXp(g.total_xp),
      badges: g.badges.map((b) => {
        const meta = BADGE_CATALOG[b.slug as BadgeSlug];
        return {
          slug: b.slug,
          label: meta?.label ?? b.slug,
          emoji: meta?.emoji ?? "🏅",
          earned_at: b.earned_at,
        };
      }),
    };
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return {
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      level: levelFromXp(0),
      badges: [] as unknown[],
    };
  }
}

function isMissingStudentRoute(kind: string): "401" | "502" | "500" | "403" | null {
  if (kind === "unauthenticated") return "401";
  if (kind === "clerk_error") return "502";
  if (kind === "db_error") return "500";
  if (kind === "not_enrolled") return "403";
  return null;
}

export function registerPathRoutes(app: Express): void {
  app.get("/api/me/path", clerkMiddleware(), async (req: Request, res: Response) => {
    const resolution = await resolveClerkStudent(req).catch(
      () => ({ kind: "db_error" }) as const,
    );
    const early = isMissingStudentRoute(resolution.kind);
    if (early || !("student" in resolution)) {
      const code = early ?? "403";
      const body =
        code === "401"
          ? { error: "not authenticated" }
          : code === "502"
            ? { error: "auth provider lookup failed" }
            : code === "500"
              ? { error: "internal server error" }
              : { error: "not enrolled" };
      res.status(Number(code)).json(body);
      return;
    }

    const studentId = resolution.student.student_id;
    try {
      const unavailable = unavailableStepIds();
      const [progressIds, state, enrollmentDate, signals] = await Promise.all([
        loadProgressIds(studentId),
        loadState(studentId),
        loadEnrollmentDate(studentId),
        loadSignals(studentId),
      ]);
      const now = new Date();
      const completedIds = unionCompleted(progressIds, signals, unavailable);
      const currentDay = computeCurrentDay(enrollmentDate, now, PATH_DAY_COUNT);

      const next = computeNextStep({
        steps: STEPS,
        completedIds,
        unavailableIds: unavailable,
        state,
        enrollmentDate,
        now,
        dayCount: PATH_DAY_COUNT,
      });

      // Persist the served pointer: keep shown_at when the active step is
      // unchanged (preserves the stall timer); reset it when a new step is shown.
      const newActiveId = next.step?.id ?? null;
      const shownAt =
        newActiveId && state.active_step_id === newActiveId && state.active_step_shown_at
          ? state.active_step_shown_at
          : newActiveId
            ? now
            : null;
      await upsertState(studentId, currentDay, newActiveId, shownAt);

      const summary = buildPathSummary({
        steps: STEPS,
        completedIds,
        unavailableIds: unavailable,
        currentDay,
      });
      const gamification = await readGamificationSafe(studentId);
      let leadmeCurrent: Awaited<ReturnType<typeof readLeadMeCurrent>> | null = null;
      try {
        leadmeCurrent = await readLeadMeCurrent(getPool(), {
          studentId,
          currentDay,
          now,
        });
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
      }

      res.json({
        path_version: PATH_VERSION,
        day_count: PATH_DAY_COUNT,
        next_step: toPublicStep(next),
        leadme_current: leadmeCurrent?.current_task ?? null,
        ...summary,
        gamification,
      });
    } catch (err) {
      console.error("[me path] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post(
    "/api/me/path/:stepId/complete",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const stepId = req.params.stepId;
      if (typeof stepId !== "string") {
        res.status(400).json({ error: "invalid step id" });
        return;
      }

      const resolution = await resolveClerkStudent(req).catch(
        () => ({ kind: "db_error" }) as const,
      );
      const early = isMissingStudentRoute(resolution.kind);
      if (early || !("student" in resolution)) {
        const code = early ?? "403";
        res.status(Number(code)).json({ error: codeMessage(code) });
        return;
      }
      const studentId = resolution.student.student_id;

      const step = STEPS.find((s) => s.id === stepId) ?? null;
      if (!step) {
        res.status(404).json({ error: "step not found" });
        return;
      }

      const unavailable = unavailableStepIds();
      if (unavailable.has(stepId)) {
        res.status(409).json({ error: "step not available" });
        return;
      }

      try {
        // Validate the completion rule against the real signal (server-side).
        const rule = step.completion_rule;
        if (rule.kind !== "self_declared") {
          const signals = await loadSignals(studentId);
          if (!signalSatisfiesStep(step, signals)) {
            res.status(422).json({
              error: "completion_rule_not_met",
              rule_kind: rule.kind,
              ...ruleProgress(rule, signals),
            });
            return;
          }
        }

        // Record the completion. INSERT IGNORE → exactly-once; a re-submit of an
        // already-complete step is a no-op (no double XP).
        const inserted = await insertProgress(studentId, stepId);

        let grant: Awaited<ReturnType<typeof grantBootCampActivity>> | null = null;
        if (inserted && step.xp >= 0) {
          // Did finishing this step just complete its day? (badge on day 1.)
          const completedAfter = await completedSetAfter(studentId, stepId, unavailable);
          const summary = buildPathSummary({
            steps: STEPS,
            completedIds: completedAfter,
            unavailableIds: unavailable,
            currentDay: step.day,
          });
          const badges: BadgeSlug[] =
            summary.day_complete && step.day === 1 ? ["path-day1-complete"] : [];
          grant = await grantBootCampActivity(getPool(), {
            studentId,
            sourceType: "path_step",
            sourceRef: stepId,
            xp: step.xp,
            contentBadges: badges,
            now: new Date(),
          });
        }

        // Return the new next step so the client can advance without a round-trip.
        const next = await computeNextForStudent(studentId, unavailable);

        res.json({
          step_id: stepId,
          status: inserted ? "completed" : "already_complete",
          xp_earned: grant?.xp_earned ?? 0,
          total_xp: grant?.total_xp ?? null,
          badges_unlocked: grant?.badges_unlocked ?? [],
          next_step: toPublicStep(next),
        });
      } catch (err) {
        if (isMissingTableError(err)) {
          // Progress table not provisioned: report no persistence rather than 500
          // so the client can still advance locally.
          res.json({
            step_id: stepId,
            status: "not_provisioned",
            xp_earned: 0,
            total_xp: null,
            badges_unlocked: [],
            next_step: null,
          });
          return;
        }
        console.error("[me path complete] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}

function codeMessage(code: "401" | "502" | "500" | "403"): string {
  if (code === "401") return "not authenticated";
  if (code === "502") return "auth provider lookup failed";
  if (code === "500") return "internal server error";
  return "not enrolled";
}

function ruleProgress(
  rule: PathStep["completion_rule"],
  signals: CompletionSignals,
): Record<string, number | boolean> {
  switch (rule.kind) {
    case "quiz_attempts_count":
      return { required: rule.required, actual: signals.quizAttemptCounts.get(rule.set_id) ?? 0 };
    case "flashcard_deck_reviewed":
      return { required: rule.required, actual: signals.flashcardReviewCounts.get(rule.deck_id) ?? 0 };
    case "foundations_lesson_complete":
      return { required: 1, actual: signals.foundationsCompleted.has(rule.lesson_slug) ? 1 : 0 };
    default:
      return {};
  }
}

async function insertProgress(studentId: string, stepId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `INSERT IGNORE INTO student_path_progress (student_id, step_id, path_version)
     VALUES ($1, $2, $3)`,
    [studentId, stepId, PATH_VERSION],
  );
  return rowCount === 1;
}

async function completedSetAfter(
  studentId: string,
  justCompletedStepId: string,
  unavailable: Set<string>,
): Promise<Set<string>> {
  const [progressIds, signals] = await Promise.all([
    loadProgressIds(studentId),
    loadSignals(studentId),
  ]);
  const set = unionCompleted(progressIds, signals, unavailable);
  set.add(justCompletedStepId);
  return set;
}

async function computeNextForStudent(studentId: string, unavailable: Set<string>) {
  const [progressIds, state, enrollmentDate, signals] = await Promise.all([
    loadProgressIds(studentId),
    loadState(studentId),
    loadEnrollmentDate(studentId),
    loadSignals(studentId),
  ]);
  const now = new Date();
  const completedIds = unionCompleted(progressIds, signals, unavailable);
  return computeNextStep({
    steps: STEPS,
    completedIds,
    unavailableIds: unavailable,
    state,
    enrollmentDate,
    now,
    dayCount: PATH_DAY_COUNT,
  });
}
