import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { z } from "zod";
import { getPool } from "../db.js";
import {
  readDebriefIntelElementById,
  readDebriefIntelElements,
} from "../lib/leadme-debrief-service.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const listQuery = z.object({
  type: z.string().trim().min(1).max(64).optional(),
  outline_code: z.string().trim().min(1).max(8).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function elementIdFromParams(req: Request): string | null {
  const raw = req.params.elementId;
  const elementId = Array.isArray(raw) ? raw[0] : raw;
  return elementId && elementId.length <= 128 ? elementId : null;
}

async function requireEnrolled(req: Request, res: Response): Promise<boolean> {
  const resolution = await resolveClerkStudent(req);
  if (resolution.kind === "unauthenticated") {
    res.status(401).json({ error: "not authenticated" });
    return false;
  }
  if (resolution.kind === "clerk_error") {
    res.status(502).json({ error: "auth provider lookup failed" });
    return false;
  }
  if (resolution.kind === "not_enrolled" || !resolution.student.enrolled) {
    res.status(403).json({ error: "enrollment required" });
    return false;
  }
  return true;
}

export function registerDebriefIntelRoutes(app: Express): void {
  app.get("/api/debrief-intel/elements", clerkMiddleware(), async (req: Request, res: Response) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      if (!(await requireEnrolled(req, res))) return;
      const elements = await readDebriefIntelElements(getPool(), {
        type: parsed.data.type,
        outlineCode: parsed.data.outline_code,
        limit: parsed.data.limit,
      });
      res.json({ elements });
    } catch (err) {
      console.error("[debrief intel list] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/debrief-intel/elements/:elementId", clerkMiddleware(), async (req: Request, res: Response) => {
    const elementId = elementIdFromParams(req);
    if (!elementId) {
      res.status(400).json({ error: "invalid element id" });
      return;
    }

    try {
      if (!(await requireEnrolled(req, res))) return;
      const element = await readDebriefIntelElementById(getPool(), elementId);
      if (!element) {
        res.status(404).json({ error: "element not found" });
        return;
      }
      res.json({ element });
    } catch (err) {
      console.error("[debrief intel detail] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
