// GET /api/red-zones — student's Red-Zone Map grouped by dimension.
//
// student_id is read from a query parameter (?student_id=<uuid>) until Clerk
// is wired. Without a student_id we return an empty map with the locked CTA
// copy so the frontend can render the "Take the diagnostic" empty state.

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ZONES_PER_DIMENSION = 5;

interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}

export function registerRedZonesRoutes(app: Express): void {
  app.get("/api/red-zones", async (req: Request, res: Response) => {
    const raw = req.query.student_id;
    const studentId = typeof raw === "string" && UUID_RE.test(raw) ? raw : null;

    if (!studentId) {
      res.json({
        by_dimension: {},
        message: "Take the diagnostic to build your Red-Zone Map.",
      });
      return;
    }

    try {
      const { rows } = await getPool().query<RedZoneRow>(
        `SELECT dimension, tag_value, proficiency_score,
                attempts_count, high_confidence_wrong_count
           FROM user_red_zones
          WHERE student_id = $1
          ORDER BY dimension ASC, proficiency_score ASC`,
        [studentId],
      );

      const byDimension: Record<
        string,
        Array<{
          tag: string;
          proficiency_score: number;
          attempts: number;
          high_confidence_wrongs: number;
        }>
      > = {};

      for (const r of rows) {
        const list = byDimension[r.dimension] ?? [];
        if (list.length < MAX_ZONES_PER_DIMENSION) {
          list.push({
            tag: r.tag_value,
            proficiency_score: Number(r.proficiency_score),
            attempts: r.attempts_count,
            high_confidence_wrongs: r.high_confidence_wrong_count,
          });
        }
        byDimension[r.dimension] = list;
      }

      res.json({ by_dimension: byDimension });
    } catch (err) {
      console.error("[red-zones get] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
