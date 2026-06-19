import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { z } from "zod";
import { getPool } from "../db.js";
import {
  readOutlineAtlas,
  readOutlineAtlasNode,
} from "../lib/outline-atlas.js";
import { enqueueLeadMeSetForOutline } from "../lib/leadme-runtime-store.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const atlasQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const startOutlineLeadMeBody = z.object({
  current_day: z.number().int().min(1).max(365).optional(),
});

function codeFromParams(req: Request): string | null {
  const raw = req.params.code;
  const code = Array.isArray(raw) ? raw[0] : raw;
  return code && /^[0-9]{8}$/.test(code) ? code : null;
}

function currentDayFromQuery(req: Request): number {
  const raw = req.query.current_day;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
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

export function registerOutlineAtlasRoutes(app: Express): void {
  app.get("/api/outline-atlas", async (req: Request, res: Response) => {
    const parsed = atlasQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await readOutlineAtlas(getPool(), { limit: parsed.data.limit }));
    } catch (err) {
      console.error("[outline atlas] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/outline-atlas/:code", async (req: Request, res: Response) => {
    const code = codeFromParams(req);
    if (!code) {
      res.status(400).json({ error: "invalid outline code" });
      return;
    }

    try {
      const node = await readOutlineAtlasNode(getPool(), { code });
      if (!node) {
        res.status(404).json({ error: "outline node not found" });
        return;
      }
      res.json(node);
    } catch (err) {
      console.error("[outline atlas node] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/me/outline-atlas", clerkMiddleware(), async (req: Request, res: Response) => {
    const parsed = atlasQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const studentId = await resolveStudentId(req, res);
      if (!studentId) return;
      res.json(await readOutlineAtlas(getPool(), {
        studentId,
        limit: parsed.data.limit,
      }));
    } catch (err) {
      console.error("[me outline atlas] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/me/outline-atlas/:code", clerkMiddleware(), async (req: Request, res: Response) => {
    const code = codeFromParams(req);
    if (!code) {
      res.status(400).json({ error: "invalid outline code" });
      return;
    }

    try {
      const studentId = await resolveStudentId(req, res);
      if (!studentId) return;
      const node = await readOutlineAtlasNode(getPool(), { code, studentId });
      if (!node) {
        res.status(404).json({ error: "outline node not found" });
        return;
      }
      res.json(node);
    } catch (err) {
      console.error("[me outline atlas node] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post("/api/me/outline-atlas/:code/leadme", clerkMiddleware(), async (req: Request, res: Response) => {
    const code = codeFromParams(req);
    if (!code) {
      res.status(400).json({ error: "invalid outline code" });
      return;
    }

    const parsed = startOutlineLeadMeBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const studentId = await resolveStudentId(req, res);
      if (!studentId) return;
      const started = await enqueueLeadMeSetForOutline(getPool(), {
        studentId,
        outlineCode: code,
        currentDay: parsed.data.current_day ?? currentDayFromQuery(req),
      });
      if (!started) {
        res.status(404).json({ error: "outline leadme set not found" });
        return;
      }
      res.json({ ok: true, started });
    } catch (err) {
      console.error("[me outline atlas leadme start] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
