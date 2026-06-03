// Admin C3 operations (triage A3 + A4 + C2). Secret-guarded, missing-table
// tolerant. Kept in one file/registration to minimize churn in index.ts.
//   GET   /api/admin/review-queue            — list items (A3)
//   PATCH /api/admin/review-queue/:id         — resolve/triage an item (A3)
//   POST  /api/admin/c3/item-stats/recompute  — recompute per-item psychometrics (A4)
//   POST  /api/admin/c3/solver/run            — run the solver over untagged items (C2)
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import {
  isReviewStatus, isReviewReason, isTerminalStatus, type ReviewStatus,
} from "../lib/review-queue.js";
import { recomputeCohortItemStats, DEFAULT_COHORT } from "../lib/c3-item-stats-service.js";
import { runSolverOverUntagged } from "../lib/c3-solver-service.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Question statuses an admin may set when resolving a review item.
const ALLOWED_QUESTION_STATUS = new Set(["active", "hidden", "review", "retired", "blocked"]);

function requireAdminSecret(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "admin access not configured (ADMIN_SECRET not set)" });
    return false;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

const patchBody = z.object({
  status: z.string(),
  reviewer_notes: z.string().max(4000).optional(),
  assigned_to: z.string().max(255).optional(),
  question_status: z.string().optional(),
});

export function registerAdminC3Routes(app: Express): void {
  // ── A3: list ────────────────────────────────────────────────────────────
  app.get("/api/admin/review-queue", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const reason = typeof req.query.reason === "string" ? req.query.reason : undefined;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));

    const where: string[] = [];
    const params: unknown[] = [];
    if (status && isReviewStatus(status)) { params.push(status); where.push(`status = $${params.length}`); }
    if (reason && isReviewReason(reason)) { params.push(reason); where.push(`reason = $${params.length}`); }
    params.push(limit);
    const sql =
      `SELECT review_id, question_id, reason, status, priority, details,
              assigned_to, reviewer_notes, created_at, resolved_at
         FROM review_queue
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY priority DESC, created_at ASC
        LIMIT $${params.length}`;
    try {
      const { rows } = await getPool().query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "review queue not provisioned" }); return; }
      console.error("[admin review-queue list] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ── A3: resolve / triage ──────────────────────────────────────────────────
  app.patch("/api/admin/review-queue/:id", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const id = req.params.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) { res.status(400).json({ error: "invalid review id" }); return; }
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const { status, reviewer_notes, assigned_to, question_status } = parsed.data;
    if (!isReviewStatus(status)) { res.status(400).json({ error: `invalid status '${status}'` }); return; }
    if (question_status !== undefined && !ALLOWED_QUESTION_STATUS.has(question_status)) {
      res.status(400).json({ error: `invalid question_status '${question_status}'` }); return;
    }

    const pool = getPool();
    try {
      const resolvedAtSql = isTerminalStatus(status as ReviewStatus) ? "CURRENT_TIMESTAMP(6)" : "NULL";
      const upd = await pool.query(
        `UPDATE review_queue
            SET status = $1,
                reviewer_notes = COALESCE($2, reviewer_notes),
                assigned_to = COALESCE($3, assigned_to),
                resolved_at = ${resolvedAtSql}
          WHERE review_id = $4`,
        [status, reviewer_notes ?? null, assigned_to ?? null, id],
      );
      if ((upd.rowCount ?? 0) === 0) { res.status(404).json({ error: "review item not found" }); return; }

      let questionUpdated = false;
      if (question_status) {
        const q = await pool.query(
          `UPDATE questions SET status = $1
            WHERE question_id = (SELECT question_id FROM review_queue WHERE review_id = $2)`,
          [question_status, id],
        );
        questionUpdated = (q.rowCount ?? 0) > 0;
      }
      res.json({ review_id: id, status, question_updated: questionUpdated });
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "review queue not provisioned" }); return; }
      console.error("[admin review-queue patch] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ── A4: recompute item live stats ─────────────────────────────────────────
  app.post("/api/admin/c3/item-stats/recompute", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const cohortId = typeof req.body?.cohort_id === "string" && req.body.cohort_id.trim()
      ? req.body.cohort_id.trim() : DEFAULT_COHORT;
    try {
      const summary = await recomputeCohortItemStats(cohortId);
      res.json(summary);
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "item_live_stats not provisioned" }); return; }
      console.error("[admin item-stats recompute] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ── C2: run the solver over untagged questions ────────────────────────────
  app.post("/api/admin/c3/solver/run", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const limit = Number(req.body?.limit) || 50;
    try {
      const summary = await runSolverOverUntagged(limit);
      res.json(summary);
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "c3 layer not provisioned" }); return; }
      console.error("[admin solver run] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
