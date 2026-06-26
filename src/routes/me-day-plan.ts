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
  type DayPlanManifest,
  type DayPlanSummary,
  type LeadMePath,
} from "../lib/day-plan.js";
import {
  recordLeadMeV5ChoiceEvent,
  readLeadMeV5CandidateManifest,
  scoreLeadMeV5CandidateResponse,
  shouldRecordLeadMeV5DailyCompletion,
  type LeadMeV5ResponseResult,
} from "../lib/leadme-v5-day-plan.js";
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

type DayPlanCompleteResponse = DayPlanResponse & {
  ok: true;
  completed_step_id: string;
  completion_gamification: GamificationGrant | null;
  leadme_v5_result: LeadMeV5ResponseResult | null;
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
      }, leadMeOutlineCodeFromQuery(req)));
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
        const outlineCode = selectedLeadMeOutlineCode(req.body) ?? leadMeOutlineCodeFromQuery(req);
        const activeManifest = await readActiveLeadMeManifest(pool, outlineCode);
        const dayKey = programDayKey(now, activeManifest.timezone, activeManifest.rollover_hour);
        const selectedResponse = selectedLeadMeResponse(req.body);
        const timeSpentSec = selectedLeadMeTimeSpentSec(req.body);
        await ensureDayPlanTables(pool);
        if (!isLeadMeV5TestManifest(activeManifest)) {
          await rolloverPriorDailySteps(pool, {
            studentId: resolution.student.student_id,
            currentDayKey: dayKey,
            manifest: activeManifest,
            now,
          });
        }

        const dailyStep = activeManifest.steps.find((step) => step.step_id === stepId) ?? null;
        let gamification: GamificationGrant | null = null;
        let leadMeV5Result: LeadMeV5ResponseResult | null = null;
        if (dailyStep) {
          if (dailyStep.content_ref.type === "leadme_v5_candidate" && (dailyStep.leadme_v5_item?.options.length ?? 0) > 0) {
            if (!selectedResponse) {
              res.status(400).json({ error: "selected_response required" });
              return;
            }
            try {
              leadMeV5Result = await scoreLeadMeV5CandidateResponse(pool, {
                itemId: dailyStep.content_ref.id,
                selectedResponse,
              });
            } catch {
              res.status(400).json({ error: "invalid selected_response" });
              return;
            }
            await recordLeadMeV5ChoiceEvent(pool, {
              studentId: resolution.student.student_id,
              dayKey,
              planKey: activeManifest.plan_key,
              stepId: dailyStep.step_id,
              mainItemId: dailyStep.main_item_id,
              outlineCode,
              timeSpentSec,
              result: leadMeV5Result,
            });
          }
          if (shouldRecordLeadMeV5DailyCompletion(leadMeV5Result)) {
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
              manifest: activeManifest,
              now,
            });
          }
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
        }, outlineCode);
        const completeResponse: DayPlanCompleteResponse = {
          ok: true,
          completed_step_id: stepId,
          completion_gamification: gamification,
          leadme_v5_result: leadMeV5Result,
          ...response,
        };
        res.json(completeResponse);
      } catch (err) {
        console.error("[me-day-plan complete] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}

function selectedLeadMeResponse(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as { selected_response?: unknown }).selected_response;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function selectedLeadMeTimeSpentSec(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as { time_spent_sec?: unknown }).time_spent_sec;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 24 * 60 * 60
    ? value
    : null;
}

function selectedLeadMeOutlineCode(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return cleanOutlineCode((body as { outline_code?: unknown }).outline_code);
}

function leadMeOutlineCodeFromQuery(req: Request): string | null {
  return cleanOutlineCode(req.query.leadme_code ?? req.query.outline_code);
}

function cleanOutlineCode(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && /^[0-9]{8}$/.test(raw) ? raw : null;
}

async function readDayPlanResponse(
  pool: DbPool,
  studentId: string,
  now: Date,
  account: { status: string | null; refunded: boolean },
  outlineCode?: string | null,
): Promise<DayPlanResponse> {
  const activeManifest = await readActiveLeadMeManifest(pool, outlineCode);
  const isV5Test = isLeadMeV5TestManifest(activeManifest);
  const dayKey = programDayKey(now, activeManifest.timezone, activeManifest.rollover_hour);
  await ensureDayPlanTables(pool);
  if (!isV5Test) {
    await rolloverPriorDailySteps(pool, {
      studentId,
      currentDayKey: dayKey,
      manifest: activeManifest,
      now,
    });
  }
  const [completedDaily, completedCatchup, catchupBank, gamification] = await Promise.all([
    readCompletedStepIds(pool, { studentId, dayKey, source: "daily" }),
    readCompletedStepIds(pool, { studentId, dayKey, source: "catchup" }),
    isV5Test ? Promise.resolve([]) : readPendingCatchupBank(pool, studentId),
    shapeGamification(pool, studentId),
  ]);
  const plan = buildLeadMePath({
    manifest: activeManifest,
    completedDailyStepIds: completedDaily,
    completedCatchupIds: completedCatchup,
    catchupBank,
    maxCatchupPerDay: isV5Test ? 0 : undefined,
  });
  const completedPlanKeys = new Set<string>();
  if (completedDaily.size >= activeManifest.steps.length) completedPlanKeys.add(activeManifest.plan_key);

  return {
    enrolled: true,
    status: account.status,
    refunded: account.refunded,
    student_id: studentId,
    day_key: dayKey,
    timezone: activeManifest.timezone,
    rollover_hour: activeManifest.rollover_hour,
    day_summaries: buildDayPlanSummaries({
      manifests: activeManifest === DAY1_PLAN ? DAY_GUIDED_PLANS : [activeManifest],
      activePlanKey: activeManifest.plan_key,
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
    manifest: DayPlanManifest;
    now: Date;
  },
): Promise<void> {
  const completed = await readCompletedStepIds(pool, {
    studentId: input.studentId,
    dayKey: input.dayKey,
    source: "daily",
  });
  const itemSteps = input.manifest.steps.filter((step) => step.main_item_id === input.mainItemId);
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
  const dayComplete = input.manifest.steps.every((step) => completed.has(step.step_id));
  if (dayComplete) {
    await grantSafely(pool, {
      studentId: input.studentId,
      sourceType: "day_plan_complete",
      sourceRef: `${input.dayKey}:${input.manifest.plan_key}`,
      xp: DAY_COMPLETE_XP,
      contentBadges: ["guided-day"],
      now: input.now,
    });
  }
}

async function readActiveLeadMeManifest(pool: DbPool, outlineCode?: string | null): Promise<DayPlanManifest> {
  return (await readLeadMeV5CandidateManifest(pool, outlineCode)) ?? DAY1_PLAN;
}

function isLeadMeV5TestManifest(manifest: DayPlanManifest): boolean {
  return manifest.plan_key.startsWith("leadme-v5-");
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
