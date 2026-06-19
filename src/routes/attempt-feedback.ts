import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { z } from "zod";
import { getPool } from "../db.js";
import { recordAttemptFeedback } from "../lib/attempt-feedback.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const feedbackBody = z.object({
  eliminated_choices: z.array(z.string().trim().min(1).max(16)).max(8).default([]),
  struggle_pair: z.array(z.string().trim().min(1).max(16)).length(2).nullable().optional(),
  why_selected: z.string().trim().min(1).max(128).nullable().optional(),
  skipped: z.boolean().optional(),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAttemptEventId(value: string): boolean {
  return uuidPattern.test(value);
}

function attemptEventIdFromParams(req: Request): string | null {
  const raw = req.params.attemptEventId;
  const attemptEventId = Array.isArray(raw) ? raw[0] : raw;
  return attemptEventId && isValidAttemptEventId(attemptEventId) ? attemptEventId : null;
}

export function registerAttemptFeedbackRoutes(app: Express): void {
  app.post(
    "/api/me/attempts/:attemptEventId/feedback",
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

        const attemptEventId = attemptEventIdFromParams(req);
        if (!attemptEventId) {
          res.status(400).json({ error: "invalid attempt event id" });
          return;
        }

        const parsed = feedbackBody.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.flatten() });
          return;
        }

        const recorded = await recordAttemptFeedback(getPool(), {
          studentId: resolution.student.student_id,
          attemptEventId,
          eliminatedChoices: parsed.data.eliminated_choices,
          strugglePair: parsed.data.struggle_pair ?? null,
          whySelected: parsed.data.why_selected ?? null,
          skipped: parsed.data.skipped ?? false,
        });
        if (!recorded) {
          res.status(404).json({ error: "attempt not found" });
          return;
        }

        res.json({ ok: true, feedback_id: recorded.feedback_id });
      } catch (err) {
        console.error("[attempt feedback] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}
