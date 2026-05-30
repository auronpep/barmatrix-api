// Foundations ("The Method" / C3 course) routes — the gated core starter.
//
// Public content (anonymous, DB-free — the lessons are authored, shipped in
// src/lib/foundations.data.ts):
//   GET  /api/foundations              → course outline (parts + lesson metadata)
//   GET  /api/foundations/:slug        → one lesson (full body + drills + keys)
//
// Per-student progress (Clerk-gated; student resolved SERVER-SIDE, never trusted
// from the client — same model as routes/me*.ts):
//   GET  /api/me/foundations           → outline merged with this student's status
//   POST /api/me/foundations/:slug     → upsert lesson progress (mark complete /
//                                         record self-checked drills)
//
// The foundations_progress table is founder-gated (SCHEMA_FOUNDATIONS_MYSQL.sql)
// and may be ABSENT in production. Authed reads degrade to zero-progress and the
// write degrades to persisted=false (never a 500), mirroring the catalog-missing
// tolerance in routes/tensions.ts.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  getCourse,
  getLessonBySlug,
  isValidLessonSlug,
  normalizeProgressUpdate,
  shapeLessonResponse,
  shapeOutline,
  summarizeProgress,
  type ProgressRow,
} from "../lib/foundations.js";

// mysql2 surfaces a missing table as ER_NO_SUCH_TABLE / errno 1146. Treat the
// unprovisioned progress table as "no progress yet", not a 500.
function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

async function loadProgressRows(studentId: string): Promise<ProgressRow[]> {
  const { rows } = await getPool().query<ProgressRow>(
    `SELECT lesson_slug, status, drills_completed, completed_at, updated_at
       FROM foundations_progress
      WHERE student_id = $1`,
    [studentId],
  );
  return rows;
}

export function registerFoundationsRoutes(app: Express): void {
  // ---- public content ----

  app.get("/api/foundations", (_req: Request, res: Response) => {
    // Anonymous callers get the outline with empty progress.
    res.json(shapeOutline([]));
  });

  app.get("/api/foundations/:slug", (req: Request, res: Response) => {
    const slug = req.params.slug;
    if (!isValidLessonSlug(slug)) {
      res.status(400).json({ error: "invalid lesson slug" });
      return;
    }
    const lesson = getLessonBySlug(slug);
    if (!lesson) {
      res.status(404).json({ error: "lesson not found" });
      return;
    }
    res.json(shapeLessonResponse(lesson, null));
  });

  // ---- authenticated progress ----

  app.get(
    "/api/me/foundations",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const resolution = await resolveClerkStudent(req).catch(
        () => ({ kind: "db_error" }) as const,
      );
      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (resolution.kind === "db_error") {
        res.status(500).json({ error: "internal server error" });
        return;
      }
      // not_enrolled (signed in, no student row yet) still gets the outline so the
      // course is browsable; progress is simply empty.
      if (resolution.kind === "not_enrolled") {
        res.json(shapeOutline([]));
        return;
      }

      try {
        const rows = await loadProgressRows(resolution.student.student_id);
        res.json(shapeOutline(rows));
      } catch (err) {
        if (isMissingTableError(err)) {
          res.json(shapeOutline([]));
          return;
        }
        console.error("[me foundations] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );

  app.post(
    "/api/me/foundations/:slug",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const slug = req.params.slug;
      if (!isValidLessonSlug(slug)) {
        res.status(400).json({ error: "invalid lesson slug" });
        return;
      }
      const lesson = getLessonBySlug(slug);
      if (!lesson) {
        res.status(404).json({ error: "lesson not found" });
        return;
      }

      const resolution = await resolveClerkStudent(req).catch(
        () => ({ kind: "db_error" }) as const,
      );
      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (resolution.kind === "db_error") {
        res.status(500).json({ error: "internal server error" });
        return;
      }
      if (resolution.kind === "not_enrolled") {
        res.status(403).json({ error: "not enrolled" });
        return;
      }

      const update = normalizeProgressUpdate(lesson, req.body);
      const studentId = resolution.student.student_id;
      const completedAt = update.status === "completed" ? new Date() : null;

      try {
        // Upsert: keep the earliest completed_at (COALESCE existing first) so a
        // re-submit doesn't reset the completion timestamp.
        await getPool().query(
          `INSERT INTO foundations_progress
             (student_id, lesson_slug, status, drills_completed, completed_at)
           VALUES ($1, $2, $3, $4, $5)
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             drills_completed = VALUES(drills_completed),
             completed_at = COALESCE(foundations_progress.completed_at, VALUES(completed_at))`,
          [
            studentId,
            slug,
            update.status,
            JSON.stringify(update.drills_completed),
            completedAt,
          ],
        );
      } catch (err) {
        if (isMissingTableError(err)) {
          // Progress table not provisioned yet: report no persistence rather than
          // 500 so the client can still advance the reader locally.
          res.json({
            persisted: false,
            reason: "not_provisioned",
            lesson_slug: slug,
            status: update.status,
            drills_completed: update.drills_completed,
          });
          return;
        }
        console.error("[me foundations update] failed:", err);
        res.status(500).json({ error: "internal server error" });
        return;
      }

      try {
        const rows = await loadProgressRows(studentId);
        res.json({
          persisted: true,
          lesson_slug: slug,
          status: update.status,
          drills_completed: update.drills_completed,
          progress: summarizeProgress(rows),
        });
      } catch (err) {
        console.error("[me foundations summary] failed:", err);
        // The write succeeded; surface that even if the re-read failed.
        res.json({
          persisted: true,
          lesson_slug: slug,
          status: update.status,
          drills_completed: update.drills_completed,
        });
      }
    },
  );
}

// Re-exported so a smoke test / build can confirm the content module loaded.
export { getCourse };
