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
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  findGradedItem,
  getCourse,
  getLessonBySlug,
  isItemVisible,
  isValidLessonSlug,
  normalizeProgressUpdate,
  shapeLessonResponse,
  shapeOutline,
  summarizeProgress,
  type ContentEnv,
  type ProgressRow,
} from "../lib/foundations.js";
import { gradeC3Attempt, type C3StudentResponse } from "../lib/c3-drill.js";

// Interactive drills carry reconstructed-from-memory keys pending an attorney
// pass; only "approved" items reach public callers. FOUNDATIONS_INTERNAL=1 on a
// dev/staging box exposes pending items for testing the trainer end-to-end.
function contentEnv(): ContentEnv {
  return process.env.FOUNDATIONS_INTERNAL === "1" ? "internal" : "public";
}

const C3_STATUS = z.enum([
  "TRUE",
  "NOT_TRUE",
  "TRUE_BUT_NOT_RESPONSIVE",
  "SURVIVES",
]);

const attemptBody = z.object({
  drill_id: z.string().min(1).max(16),
  item_id: z.string().min(1).max(64),
  selected_status: C3_STATUS.optional(),
  // LABEL_SELECT choices use the full label text as their id (up to ~64 chars,
  // e.g. drill 10.4). The old max(8) silently 400'd every long-label LABEL_SELECT
  // attempt BEFORE grading. Keep in sync with foundations_attempts.selected_choice_id.
  selected_choice_id: z.string().min(1).max(128).optional(),
  selected_choice_statuses: z.record(z.string().max(128), C3_STATUS).optional(),
  // MULTI_SELECT (full-workflow drills): part_id -> chosen choice id, graded per part.
  selected_parts: z.record(z.string().max(32), z.string().max(128)).optional(),
  attempt_number: z.number().int().min(1).max(50).default(1),
  time_ms: z.number().int().min(0).max(3_600_000).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  reflection_text: z.string().max(2000).optional(),
});

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
    res.json(shapeLessonResponse(lesson, null, contentEnv()));
  });

  // ---- interactive drill grading (the C3 reflex trainer) ----
  //
  // Optional auth: anonymous callers get graded (no persistence); signed-in
  // enrolled students also get the attempt recorded. The answer key never ships
  // to the client until this endpoint grades a submission, so the lesson cannot
  // be completed by revealing a key.
  app.post(
    "/api/foundations/:slug/attempts",
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

      const parse = attemptBody.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten() });
        return;
      }
      const body = parse.data;

      const item = findGradedItem(lesson, body.drill_id, body.item_id);
      if (!item) {
        res.status(404).json({ error: "drill item not found" });
        return;
      }
      // Parity with the content gate: you can only be graded on an item you were
      // allowed to see (else grading would distribute a pending key).
      if (!isItemVisible(item, contentEnv())) {
        res.status(403).json({ error: "item not available" });
        return;
      }

      const response: C3StudentResponse = {
        selected_status: body.selected_status,
        selected_choice_id: body.selected_choice_id,
        selected_choice_statuses: body.selected_choice_statuses,
        selected_parts: body.selected_parts,
      };
      const grade = gradeC3Attempt(item, response);

      // Persist only for signed-in, enrolled students. Anonymous learners are
      // graded but not recorded (the client keeps local session state).
      let persisted = false;
      let attemptId: string | null = null;
      const resolution = await resolveClerkStudent(req).catch(
        () => ({ kind: "db_error" }) as const,
      );
      const noPersistKinds = new Set([
        "unauthenticated",
        "clerk_error",
        "db_error",
        "not_enrolled",
      ]);
      if (!noPersistKinds.has(resolution.kind) && "student" in resolution) {
        attemptId = randomUUID();
        try {
          await getPool().query(
            `INSERT INTO foundations_attempts
               (attempt_id, student_id, lesson_slug, drill_id, item_id, task_type,
                selected_status, selected_choice_id, selected_choice_statuses,
                selected_parts,
                correct, attempt_number, time_ms, confidence,
                missed_filter, missed_skill, reflection_text)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              attemptId,
              resolution.student.student_id,
              slug,
              body.drill_id,
              body.item_id,
              item.task_type,
              body.selected_status ?? null,
              body.selected_choice_id ?? null,
              body.selected_choice_statuses
                ? JSON.stringify(body.selected_choice_statuses)
                : null,
              body.selected_parts ? JSON.stringify(body.selected_parts) : null,
              grade.correct ? 1 : 0,
              body.attempt_number,
              body.time_ms ?? null,
              body.confidence ?? null,
              grade.missed_filter,
              grade.missed_skill,
              body.reflection_text ?? null,
            ],
          );
          persisted = true;
        } catch (err) {
          if (isMissingTableError(err)) {
            attemptId = null;
          } else {
            console.error("[foundations attempt] failed:", err);
            res.status(500).json({ error: "internal server error" });
            return;
          }
        }
      }

      res.json({ graded: grade, persisted, attempt_id: attemptId });
    },
  );

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
