// Trap Taxonomy routes — Web Component 02 (HANDOFFS/WEB/02-trap-taxonomy.md).
//
//   GET /api/traps                      → catalog of wrong-answer architectures +
//                                          misconceptions with question/choice counts
//   GET /api/traps/:slug                → one trap: subject distribution + first 20
//                                          example wrong choices
//   GET /api/traps/:slug/questions      → paged distinct questions that use the trap
//                                          as a distractor (?page, ?limit)
//
// Reads are anonymous and DB-backed. The query logic + shaping lives in
// lib/traps.ts so it can be unit-tested without a live database.

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";
import { config } from "../config.js";
import {
  buildTrapExamplesQuery,
  buildTrapListQuery,
  buildTrapQuestionsCountQuery,
  buildTrapQuestionsQuery,
  buildTrapSubjectDistributionQuery,
  clampTrapPage,
  clampTrapQuestionsLimit,
  normalizeTrapSlug,
  resolveIncludeHidden,
  shapeTrapDetail,
  shapeTrapList,
  shapeTrapQuestions,
  TrapInputError,
  type TrapExampleRow,
  type TrapListRow,
  type TrapQuestionRow,
  type TrapSubjectRow,
} from "../lib/traps.js";

export function registerTrapsRoutes(app: Express): void {
  // GET /api/traps — full catalog, split into architecture vs misconception.
  app.get("/api/traps", async (req: Request, res: Response) => {
    const includeHidden = resolveIncludeHidden(
      req.query.include_hidden,
      config.nodeEnv,
    );

    try {
      const query = buildTrapListQuery(includeHidden);
      const { rows } = await getPool().query<TrapListRow>(query.sql, query.values);
      res.json(shapeTrapList(rows));
    } catch (err) {
      console.error("[traps list] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /api/traps/:slug — trap detail. 404 when the slug is neither observed in
  // the bank nor an official taxonomy entry.
  app.get("/api/traps/:slug", async (req: Request, res: Response) => {
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

    const includeHidden = resolveIncludeHidden(
      req.query.include_hidden,
      config.nodeEnv,
    );

    try {
      const pool = getPool();
      const examplesQuery = buildTrapExamplesQuery(slug, includeHidden);
      const subjectsQuery = buildTrapSubjectDistributionQuery(slug, includeHidden);

      const [examples, subjects] = await Promise.all([
        pool.query<TrapExampleRow>(examplesQuery.sql, examplesQuery.values),
        pool.query<TrapSubjectRow>(subjectsQuery.sql, subjectsQuery.values),
      ]);

      const detail = shapeTrapDetail(slug, examples.rows, subjects.rows);

      // Unknown trap: no example wrong choices, no subject coverage, and not part
      // of the locked taxonomy. Anything official stays addressable even at zero.
      if (
        detail.examples.length === 0 &&
        detail.subject_distribution.length === 0 &&
        !detail.official
      ) {
        res.status(404).json({ error: "trap not found" });
        return;
      }

      res.json(detail);
    } catch (err) {
      console.error("[trap detail] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /api/traps/:slug/questions — paged distinct questions using the trap.
  app.get("/api/traps/:slug/questions", async (req: Request, res: Response) => {
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

    const includeHidden = resolveIncludeHidden(
      req.query.include_hidden,
      config.nodeEnv,
    );
    const page = clampTrapPage(req.query.page);
    const limit = clampTrapQuestionsLimit(req.query.limit);
    const offset = (page - 1) * limit;

    try {
      const pool = getPool();
      const listQuery = buildTrapQuestionsQuery(slug, includeHidden, limit, offset);
      const countQuery = buildTrapQuestionsCountQuery(slug, includeHidden);

      const [list, count] = await Promise.all([
        pool.query<TrapQuestionRow>(listQuery.sql, listQuery.values),
        pool.query<{ total: number | string }>(countQuery.sql, countQuery.values),
      ]);

      const total = Number(count.rows[0]?.total ?? 0);
      res.json(shapeTrapQuestions(slug, page, limit, total, list.rows));
    } catch (err) {
      console.error("[trap questions] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
