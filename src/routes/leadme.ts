import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { z } from "zod";
import { getPool } from "../db.js";
import { readLeadMeCurrent } from "../lib/leadme-current-service.js";
import {
  enqueueLeadMeSet,
  markLeadMeQueueCompleted,
  markLeadMeQueueViewed,
  readLeadMeSetSummary,
} from "../lib/leadme-runtime-store.js";
import {
  submitLeadMeItem,
  type SubmitLeadMeItemResponse,
} from "../lib/leadme-submit-service.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const progressBody = z.object({
  item_id: z.string().trim().min(1).max(128).nullable().optional(),
  set_id: z.string().trim().min(1).max(128).nullable().optional(),
  time_spent_sec: z.number().int().min(0).max(24 * 60 * 60).nullable().optional(),
});

const submitBody = z.object({
  selected_response: z.string().trim().min(1).max(64),
  idempotency_key: z.string().trim().min(1).max(128),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  time_spent_sec: z.number().int().min(0).max(24 * 60 * 60).nullable().optional(),
});

const startSetBody = z.object({
  current_day: z.number().int().min(1).max(365).optional(),
});

function currentDayFromQuery(req: Request): number {
  const raw = req.query.current_day;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function queueEntryIdFromParams(req: Request): string | null {
  const rawQueueEntryId = req.params.queueEntryId;
  const queueEntryId = Array.isArray(rawQueueEntryId)
    ? rawQueueEntryId[0]
    : rawQueueEntryId;
  return queueEntryId && queueEntryId.length <= 128 ? queueEntryId : null;
}

function setIdFromParams(req: Request): string | null {
  const rawSetId = req.params.setId;
  const setId = Array.isArray(rawSetId) ? rawSetId[0] : rawSetId;
  return setId && setId.length <= 128 ? setId : null;
}

type LeadMeSubmitPublicInput = Pick<
  SubmitLeadMeItemResponse,
  "idempotent_replay" | "attempt_event_id" | "debrief_focus" | "scoring_summary"
> & {
  result: Pick<
    SubmitLeadMeItemResponse["result"],
    "correctness" | "branch_id" | "selected_response" | "back_blocks" | "next_action_summary"
  >;
};

export function toLeadMeSubmitHttpResponse(submitted: LeadMeSubmitPublicInput) {
  return {
    ok: true,
    idempotent_replay: submitted.idempotent_replay,
    attempt_event_id: submitted.attempt_event_id,
    leadme_result: {
      correctness: submitted.result.correctness,
      selected_response: submitted.result.selected_response,
      back_blocks: submitted.result.back_blocks,
      debrief_focus: submitted.debrief_focus,
      next_action: submitted.result.next_action_summary.label,
      scoring_summary: submitted.scoring_summary,
    },
  };
}

export function registerLeadMeRoutes(app: Express): void {
  app.get("/api/me/leadme/current", clerkMiddleware(), async (req: Request, res: Response) => {
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

      res.json(
        await readLeadMeCurrent(getPool(), {
          studentId: resolution.student.student_id,
          currentDay: currentDayFromQuery(req),
          now: new Date(),
        }),
      );
    } catch (err) {
      console.error("[leadme current] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get(
    "/api/me/leadme/sets/:setId/summary",
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

        const setId = setIdFromParams(req);
        if (!setId) {
          res.status(400).json({ error: "invalid set id" });
          return;
        }

        const summary = await readLeadMeSetSummary(getPool(), {
          studentId: resolution.student.student_id,
          setId,
        });
        if (!summary) {
          res.status(404).json({ error: "set not found" });
          return;
        }
        res.json({ summary });
      } catch (err) {
        console.error("[leadme set summary] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.post(
    "/api/me/leadme/sets/:setId/start",
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

        const setId = setIdFromParams(req);
        if (!setId) {
          res.status(400).json({ error: "invalid set id" });
          return;
        }
        const parsed = startSetBody.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.flatten() });
          return;
        }

        const started = await enqueueLeadMeSet(getPool(), {
          studentId: resolution.student.student_id,
          setId,
          currentDay: parsed.data.current_day ?? currentDayFromQuery(req),
        });
        if (!started) {
          res.status(404).json({ error: "set not found" });
          return;
        }
        res.json({ ok: true, started });
      } catch (err) {
        console.error("[leadme set start] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.post(
    "/api/me/leadme/items/:queueEntryId/view",
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

        const queueEntryId = queueEntryIdFromParams(req);
        if (!queueEntryId) {
          res.status(400).json({ error: "invalid queue entry id" });
          return;
        }
        const parsed = progressBody.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.flatten() });
          return;
        }

        const updated = await markLeadMeQueueViewed(getPool(), {
          studentId: resolution.student.student_id,
          queueEntryId,
          itemId: parsed.data.item_id ?? null,
          setId: parsed.data.set_id ?? null,
          timeSpentSec: parsed.data.time_spent_sec ?? null,
        });
        res.json({ ok: updated });
      } catch (err) {
        console.error("[leadme view] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.post(
    "/api/me/leadme/items/:queueEntryId/complete",
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

        const queueEntryId = queueEntryIdFromParams(req);
        if (!queueEntryId) {
          res.status(400).json({ error: "invalid queue entry id" });
          return;
        }
        const parsed = progressBody.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.flatten() });
          return;
        }

        const updated = await markLeadMeQueueCompleted(getPool(), {
          studentId: resolution.student.student_id,
          queueEntryId,
          itemId: parsed.data.item_id ?? null,
          setId: parsed.data.set_id ?? null,
          timeSpentSec: parsed.data.time_spent_sec ?? null,
        });
        res.json({ ok: updated });
      } catch (err) {
        console.error("[leadme complete] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.post(
    "/api/me/leadme/items/:queueEntryId/submit",
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

        const queueEntryId = queueEntryIdFromParams(req);
        if (!queueEntryId) {
          res.status(400).json({ error: "invalid queue entry id" });
          return;
        }

        const parsed = submitBody.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.flatten() });
          return;
        }

        const submitted = await submitLeadMeItem(getPool(), {
          studentId: resolution.student.student_id,
          queueEntryId,
          selectedResponse: parsed.data.selected_response,
          idempotencyKey: parsed.data.idempotency_key,
          confidence: parsed.data.confidence ?? null,
          timeSpentSec: parsed.data.time_spent_sec ?? null,
          now: new Date(),
        });

        res.json(toLeadMeSubmitHttpResponse(submitted));
      } catch (err) {
        console.error("[leadme submit] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}
