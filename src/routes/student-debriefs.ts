import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { z } from "zod";
import { getPool } from "../db.js";
import {
  readStudentDebrief,
  recordStudentDebriefEvent,
} from "../lib/student-debrief.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const debriefQuery = z.object({
  attempt_event_id: z.string().trim().min(1).max(128).optional(),
});

const eventBody = z.object({
  attempt_event_id: z.string().trim().min(1).max(128).nullable().optional(),
  event_type: z.enum([
    "focus_visible",
    "section_opened",
    "section_closed",
    "element_viewed",
    "detour_started",
    "detour_completed",
    "dwell",
  ]),
  section_key: z.string().trim().min(1).max(128).nullable().optional(),
  element_id: z.string().trim().min(1).max(128).nullable().optional(),
  dwell_ms: z.number().int().min(0).max(86_400_000).nullable().optional(),
  payload: z.unknown().optional(),
});

function qidFromParams(req: Request): string | null {
  const raw = req.params.qid;
  const qid = Array.isArray(raw) ? raw[0] : raw;
  return qid && qid.length <= 128 ? qid : null;
}

async function resolveStudentId(req: Request, res: Response): Promise<string | null> {
  const resolution = await resolveClerkStudent(req);
  if (resolution.kind === "unauthenticated") {
    res.status(401).json({ error: "not authenticated" });
    return null;
  }
  if (resolution.kind === "clerk_error") {
    res.status(502).json({ error: "auth provider lookup failed" });
    return null;
  }
  if (resolution.kind === "not_enrolled" || !resolution.student.enrolled) {
    res.status(403).json({ error: "enrollment required" });
    return null;
  }
  return resolution.student.student_id;
}

export function registerStudentDebriefRoutes(app: Express): void {
  app.get("/api/me/debriefs/:qid", clerkMiddleware(), async (req: Request, res: Response) => {
    const qid = qidFromParams(req);
    if (!qid) {
      res.status(400).json({ error: "invalid qid" });
      return;
    }

    const parsed = debriefQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const studentId = await resolveStudentId(req, res);
      if (!studentId) return;
      const debrief = await readStudentDebrief(getPool(), {
        studentId,
        qid,
        attemptEventId: parsed.data.attempt_event_id ?? null,
      });
      if (!debrief) {
        res.status(404).json({ error: "debrief not found" });
        return;
      }
      res.json(debrief);
    } catch (err) {
      console.error("[student debrief get] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post("/api/me/debriefs/:qid/events", clerkMiddleware(), async (req: Request, res: Response) => {
    const studentId = await resolveStudentId(req, res);
    if (!studentId) return;

    const qid = qidFromParams(req);
    if (!qid) {
      res.status(400).json({ error: "invalid qid" });
      return;
    }

    const parsed = eventBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const recorded = await recordStudentDebriefEvent(getPool(), {
        studentId,
        qid,
        attemptEventId: parsed.data.attempt_event_id ?? null,
        eventType: parsed.data.event_type,
        sectionKey: parsed.data.section_key ?? null,
        elementId: parsed.data.element_id ?? null,
        dwellMs: parsed.data.dwell_ms ?? null,
        payload: parsed.data.payload,
      });
      if (!recorded) {
        res.status(404).json({ error: "debrief not found" });
        return;
      }
      res.json({ ok: true, event_id: recorded.event_id, debrief_id: recorded.debrief_id });
    } catch (err) {
      console.error("[student debrief event] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
