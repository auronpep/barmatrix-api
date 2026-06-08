// J7 guided daily path routes.
//
//   GET  /api/me/day-plan
//   POST /api/me/day-plan/steps/:stepId/complete
//
// Paid users receive one prescribed Lead Me path. Progress is keyed by the
// program day (3 AM rollover). Previous-day misses are moved to the catchup
// bank, then catchup tasks are injected only after completed roadmap milestones.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool, type DbPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  BADGE_CATALOG,
  type BadgeSlug,
} from "../lib/gamification.js";
import {
  grantBootCampActivity,
  readGamification,
  type GamificationGrant,
} from "../lib/gamification-store.js";
import {
  DAY_GUIDED_PLANS,
  DAY1_PLAN,
  buildDayPlanSummaries,
  buildLeadMePath,
  programDayKey,
  type DayPlanSummary,
  type LeadMePath,
} from "../lib/day-plan.js";
import {
  ensureDayPlanTables,
  readCatchupById,
  readCompletedStepIds,
  readPendingCatchupBank,
  recordCatchupStepCompletion,
  recordDailyStepCompletion,
  rolloverPriorDailySteps,
} from "../lib/day-plan-store.js";

const MAIN_ITEM_XP = 25;
const DAY_COMPLETE_XP = 100;

type DayPlanResponse = {
  enrolled: boolean;
  status: string | null;
  refunded: boolean;
  student_id: string | null;
  day_key: string | null;
  timezone: string;
  rollover_hour: number;
  day_summaries: DayPlanSummary[];
  plan: LeadMePath | null;
  gamification: Awaited<ReturnType<typeof shapeGamification>> | null;
};

export function registerMeDayPlanRoutes(app: Express): void {
  app.get("/api/me/day-plan", clerkMiddleware(), async (req: Request, res: Response) => {
    try {
      const resolution = await resolveClerkStudent(req);
      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (resolution.kind === "not_enrolled" || !resolution.student.enrolled) {
        res.json(emptyDayPlanResponse(resolution.kind === "ok" ? resolution.student : null));
        return;
      }

      res.json(await readDayPlanResponse(getPool(), resolution.student.student_id, new Date(), {
        status: resolution.student.status,
        refunded: resolution.student.refunded,
      }));
    } catch (err) {
      console.error("[me-day-plan] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post(
    "/api/me/day-plan/steps/:stepId/complete",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      try {
        const resolution = await resolveClerkStudent(req);
        if (resolution.kind === "unauthenticated") {
          res.status(401).json({ error: "not authenticated" });
          return;
        }
        if (resolution.kind === "clerk_error") {
          res.status(502).json({ error: "auth provider lookup failed" });
          return;
        }
        if (resolution.kind === "not_enrolled" || !resolution.student.enrolled) {
          res.status(403).json({ error: "enrollment required" });
          return;
        }

        const rawStepId = req.params.stepId;
        const stepId = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
        if (!stepId || stepId.length > 128) {
          res.status(400).json({ error: "invalid step id" });
          return;
        }

        const pool = getPool();
        const now = new Date();
        const dayKey = programDayKey(now, DAY1_PLAN.timezone, DAY1_PLAN.rollover_hour);
        await ensureDayPlanTables(pool);
        await rolloverPriorDailySteps(pool, {
          studentId: resolution.student.student_id,
          currentDayKey: dayKey,
          manifest: DAY1_PLAN,
          now,
        });

        const dailyStep = DAY1_PLAN.steps.find((step) => step.step_id === stepId) ?? null;
        let gamification: GamificationGrant | null = null;
        if (dailyStep) {
          const inserted = await recordDailyStepCompletion(pool, {
            studentId: resolution.student.student_id,
            dayKey,
            step: dailyStep,
          });
          if (inserted) {
            gamification = await grantSafely(pool, {
              studentId: resolution.student.student_id,
              sourceType: "day_plan_step",
              sourceRef: `${dayKey}:${dailyStep.step_id}`,
              xp: dailyStep.xp,
              contentBadges: [],
              now,
            });
          }
          await grantMilestonesIfEarned(pool, {
            studentId: resolution.student.student_id,
            dayKey,
            mainItemId: dailyStep.main_item_id,
            now,
          });
        } else {
          const catchup = await readCatchupById(pool, {
            studentId: resolution.student.student_id,
            catchupId: stepId,
          });
          if (!catchup) {
            res.status(404).json({ error: "step not found" });
            return;
          }
          const inserted = await recordCatchupStepCompletion(pool, {
            studentId: resolution.student.student_id,
            dayKey,
            catchupId: stepId,
          });
          if (inserted) {
            gamification = await grantSafely(pool, {
              studentId: resolution.student.student_id,
              sourceType: "catchup_step_complete",
              sourceRef: `${catchup.original_day_key}:${catchup.original_step_id}:${stepId}`,
              xp: catchup.xp,
              contentBadges: ["catchup-clear"],
              now,
            });
          }
        }

        const response = await readDayPlanResponse(pool, resolution.student.student_id, now, {
          status: resolution.student.status,
          refunded: resolution.student.refunded,
        });
        res.json({ ok: true, completed_step_id: stepId, completion_gamification: gamification, ...response });
      } catch (err) {
        console.error("[me-day-plan complete] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}

async function readDayPlanResponse(
  pool: DbPool,
  studentId: string,
  now: Date,
  account: { status: string | null; refunded: boolean },
): Promise<DayPlanResponse> {
  const dayKey = programDayKey(now, DAY1_PLAN.timezone, DAY1_PLAN.rollover_hour);
  await ensureDayPlanTables(pool);
  await rolloverPriorDailySteps(pool, {
    studentId,
    currentDayKey: dayKey,
    manifest: DAY1_PLAN,
    now,
  });
  const [completedDaily, completedCatchup, catchupBank, gamification] = await Promise.all([
    readCompletedStepIds(pool, { studentId, dayKey, source: "daily" }),
    readCompletedStepIds(pool, { studentId, dayKey, source: "catchup" }),
    readPendingCatchupBank(pool, studentId),
    shapeGamification(pool, studentId),
  ]);
  const plan = buildLeadMePath({
    manifest: DAY1_PLAN,
    completedDailyStepIds: completedDaily,
    completedCatchupIds: completedCatchup,
    catchupBank,
  });
  const completedPlanKeys = new Set<string>();
  if (completedDaily.size >= DAY1_PLAN.steps.length) completedPlanKeys.add(DAY1_PLAN.plan_key);

  return {
    enrolled: true,
    status: account.status,
    refunded: account.refunded,
    student_id: studentId,
    day_key: dayKey,
    timezone: DAY1_PLAN.timezone,
    rollover_hour: DAY1_PLAN.rollover_hour,
    day_summaries: buildDayPlanSummaries({
      manifests: DAY_GUIDED_PLANS,
      activePlanKey: DAY1_PLAN.plan_key,
      completedPlanKeys,
    }),
    plan,
    gamification,
  };
}

async function grantMilestonesIfEarned(
  pool: DbPool,
  input: {
    studentId: string;
    dayKey: string;
    mainItemId: string;
    now: Date;
  },
): Promise<void> {
  const completed = await readCompletedStepIds(pool, {
    studentId: input.studentId,
    dayKey: input.dayKey,
    source: "daily",
  });
  const itemSteps = DAY1_PLAN.steps.filter((step) => step.main_item_id === input.mainItemId);
  const itemComplete = itemSteps.length > 0 && itemSteps.every((step) => completed.has(step.step_id));
  if (itemComplete) {
    await grantSafely(pool, {
      studentId: input.studentId,
      sourceType: "day_plan_main_item",
      sourceRef: `${input.dayKey}:${input.mainItemId}`,
      xp: MAIN_ITEM_XP,
      contentBadges: [],
      now: input.now,
    });
  }
  const dayComplete = DAY1_PLAN.steps.every((step) => completed.has(step.step_id));
  if (dayComplete) {
    await grantSafely(pool, {
      studentId: input.studentId,
      sourceType: "day_plan_complete",
      sourceRef: `${input.dayKey}:${DAY1_PLAN.plan_key}`,
      xp: DAY_COMPLETE_XP,
      contentBadges: ["guided-day"],
      now: input.now,
    });
  }
}

async function grantSafely(
  pool: DbPool,
  input: Parameters<typeof grantBootCampActivity>[1],
): Promise<GamificationGrant | null> {
  try {
    return await grantBootCampActivity(pool, input);
  } catch (err) {
    console.error("[me-day-plan] gamification grant failed:", err);
    return null;
  }
}

async function shapeGamification(pool: DbPool, studentId: string) {
  const profile = await readGamification(pool, studentId);
  return {
    total_xp: profile.total_xp,
    current_streak: profile.current_streak,
    longest_streak: profile.longest_streak,
    badges: profile.badges.map((badge) => {
      const meta = BADGE_CATALOG[badge.slug as BadgeSlug];
      return {
        slug: badge.slug,
        label: meta?.label ?? badge.slug,
        description: meta?.description ?? "",
        emoji: meta?.emoji ?? "*",
        earned_at: badge.earned_at,
      };
    }),
  };
}

function emptyDayPlanResponse(
  student: { student_id: string; status: string | null; refunded: boolean } | null,
): DayPlanResponse {
  return {
    enrolled: false,
    status: student?.status ?? null,
    refunded: student?.refunded ?? false,
    student_id: student?.student_id ?? null,
    day_key: null,
    timezone: DAY1_PLAN.timezone,
    rollover_hour: DAY1_PLAN.rollover_hour,
    day_summaries: [],
    plan: null,
    gamification: null,
  };
}
