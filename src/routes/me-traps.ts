// Authenticated Personal Trap Profile — Web Component 02 personalization.
//
//   GET /api/me/traps        — the student's most-fallen-for traps, ranked.
//   GET /api/me/traps/:slug  — one trap's personal totals + recent occurrences.
//
// Auth: @clerk/express clerkMiddleware. Student resolved SERVER-SIDE from the
// Clerk email via resolveClerkStudent (never a client-supplied id). Reads filter
// questions.status='active' (include_hidden honored only outside production).

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  buildMyTrapAggregateQuery,
  buildMyTrapOccurrencesQuery,
  buildMyTrapProfileQuery,
  deriveProfileMetrics,
  normalizeTrapSlug,
  shapeMyTrapHistory,
  shapeMyTrapProfile,
  TrapInputError,
  type MyTrapAggregateRow,
  type MyTrapOccurrenceRow,
  type MyTrapProfileRow,
} from "../lib/me-traps.js";

function includeHidden(req: Request): boolean {
  return (
    req.query.include_hidden === "true" && process.env.NODE_ENV !== "production"
  );
}

function emptyProfile() {
  return {
    enrolled: false,
    student_id: null as string | null,
    metrics: {
      distinct_traps: 0,
      total_falls: 0,
      total_confident_falls: 0,
      top_trap_slug: null as string | null,
    },
    traps: [] as unknown[],
  };
}

function emptyHistory(slug: string, name: string) {
  return {
    enrolled: false,
    slug,
    name,
    official: false,
    fell_count: 0,
    confident_fell_count: 0,
    first_fell_at: null as string | null,
    last_fell_at: null as string | null,
    recent: [] as unknown[],
  };
}

export function registerMeTrapsRoutes(app: Express): void {
  app.get("/api/me/traps", clerkMiddleware(), async (req: Request, res: Response) => {
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
      if (resolution.kind === "not_enrolled") {
        res.json(emptyProfile());
        return;
      }

      const studentId = resolution.student.student_id;
      const query = buildMyTrapProfileQuery(studentId, includeHidden(req));
      const { rows } = await getPool().query<MyTrapProfileRow>(query.sql, query.values);
      const traps = shapeMyTrapProfile(rows);

      res.json({
        enrolled: resolution.student.enrolled,
        student_id: studentId,
        metrics: deriveProfileMetrics(traps),
        traps,
      });
    } catch (err) {
      console.error("[me traps profile] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/me/traps/:slug", clerkMiddleware(), async (req: Request, res: Response) => {
    let slug: string;
    try {
      slug = normalizeTrapSlug(req.params.slug);
    } catch (err) {
      if (err instanceof TrapInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

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
      if (resolution.kind === "not_enrolled") {
        res.json(emptyHistory(slug, slug));
        return;
      }

      const studentId = resolution.student.student_id;
      const hidden = includeHidden(req);
      const pool = getPool();
      const aggQuery = buildMyTrapAggregateQuery(studentId, slug, hidden);
      const recentQuery = buildMyTrapOccurrencesQuery(studentId, slug, hidden);

      const [aggResult, recentResult] = await Promise.all([
        pool.query<MyTrapAggregateRow>(aggQuery.sql, aggQuery.values),
        pool.query<MyTrapOccurrenceRow>(recentQuery.sql, recentQuery.values),
      ]);

      const agg = aggResult.rows[0] ?? {
        fell_count: 0,
        confident_fell_count: 0,
        first_fell_at: null,
        last_fell_at: null,
      };
      const history = shapeMyTrapHistory(slug, agg, recentResult.rows);

      res.json({ enrolled: resolution.student.enrolled, ...history });
    } catch (err) {
      console.error("[me trap history] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
