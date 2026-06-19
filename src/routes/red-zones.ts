// GET /api/red-zones — student's Red-Zone Map grouped by dimension.
//
// Student identity is derived from Clerk server-side. Unauthenticated or
// unenrolled callers get the locked empty state, never another student's map.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";

const MAX_ZONES_PER_DIMENSION = 5;

interface RedZoneRow {
  dimension: string;
  tag_value: string;
  proficiency_score: string;
  attempts_count: number;
  high_confidence_wrong_count: number;
}

export function registerRedZonesRoutes(app: Express): void {
  app.get("/api/red-zones", clerkMiddleware(), async (req: Request, res: Response) => {
    try {
      const resolution = await resolveClerkStudent(req);
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (
        resolution.kind === "unauthenticated" ||
        resolution.kind === "not_enrolled" ||
        !resolution.student.enrolled
      ) {
        res.json({
          by_dimension: {},
          message: "Take the diagnostic to build your Red-Zone Map.",
        });
        return;
      }
      const studentId = resolution.student.student_id;

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
