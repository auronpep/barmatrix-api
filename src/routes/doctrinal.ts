// J7 doctrinal lessons (item 4) — attorney-gated substantive content.
//
//   GET /api/study/doctrinal/:slug → lesson markdown, ONLY when approved
//
// Content lives in src/lib/path-doctrinal.data.ts. Until DOCTRINAL_APPROVED=1 is
// set on the API server (after attorney sign-off), this returns 503 and the path
// engine treats the doctrinal step as unavailable and routes around it — the UI
// shows a "coming soon" card without breaking the path.

import type { Express, Request, Response } from "express";
import {
  getDoctrinalLesson,
  isDoctrinalApproved,
} from "../lib/path-doctrinal.data.js";

export function registerDoctrinalRoutes(app: Express): void {
  app.get("/api/study/doctrinal/:slug", (req: Request, res: Response) => {
    if (!isDoctrinalApproved()) {
      res.status(503).json({ error: "content_not_yet_approved" });
      return;
    }
    const slug = req.params.slug;
    if (typeof slug !== "string") {
      res.status(400).json({ error: "invalid slug" });
      return;
    }
    const lesson = getDoctrinalLesson(slug);
    if (!lesson) {
      res.status(404).json({ error: "lesson not found" });
      return;
    }
    res.json({
      slug: lesson.slug,
      title: lesson.title,
      subject: lesson.subject,
      estimated_minutes: lesson.estimated_minutes,
      body_md: lesson.body_md,
    });
  });
}
