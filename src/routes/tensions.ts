// Tension Map routes — Web Component 01 (HANDOFFS/WEB/01-tension-map.md).
//
//   GET /api/tensions                  → catalog of recurring legal tension points
//                                         (curated + observed-in-bank) with counts
//   GET /api/tensions/:slug            → one tension: rich copy (when curated),
//                                         subject distribution + example questions
//   GET /api/tensions/:slug/questions  → paged questions targeted to the tension
//                                         (?page, ?limit) — feeds the practice link
//
// Reads are anonymous and DB-backed. Query logic + shaping live in lib/tensions.ts
// so they unit-test without a database. The curated `tension_points` catalog is
// founder-gated (additive migration) and may be absent in prod; catalog reads
// degrade to catalog_ready=false rather than 500 (isMissingTableError).

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";
import { config } from "../config.js";
import {
  buildTensionCatalogQuery,
  buildTensionCatalogRowQuery,
  buildTensionExamplesQuery,
  buildTensionObservedQuery,
  buildTensionQuestionsCountQuery,
  buildTensionQuestionsQuery,
  buildTensionSubjectDistributionQuery,
  clampTensionPage,
  clampTensionQuestionsLimit,
  isMissingTableError,
  normalizeTensionSlug,
  resolveIncludeHidden,
  shapeTensionDetail,
  shapeTensionList,
  shapeTensionQuestions,
  tensionLinkKeys,
  TensionInputError,
  type TensionCatalogRow,
  type TensionExampleRow,
  type TensionObservedRow,
  type TensionQuestionRow,
  type TensionSubjectRow,
} from "../lib/tensions.js";

export function registerTensionsRoutes(app: Express): void {
  // GET /api/tensions — curated catalog + observed-in-bank tags with counts.
  app.get("/api/tensions", async (req: Request, res: Response) => {
    const includeHidden = resolveIncludeHidden(
      req.query.include_hidden,
      config.nodeEnv,
    );

    try {
      const pool = getPool();

      // Catalog is founder-gated: a missing table is "not provisioned", not a 500.
      let catalogRows: TensionCatalogRow[] | null = null;
      try {
        const catalogQuery = buildTensionCatalogQuery();
        const { rows } = await pool.query<TensionCatalogRow>(
          catalogQuery.sql,
          catalogQuery.values,
        );
        catalogRows = rows;
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
        catalogRows = null;
      }

      const observedQuery = buildTensionObservedQuery(includeHidden);
      const { rows: observedRows } = await pool.query<TensionObservedRow>(
        observedQuery.sql,
        observedQuery.values,
      );

      res.json(shapeTensionList(catalogRows, observedRows));
    } catch (err) {
      console.error("[tensions list] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /api/tensions/:slug — tension detail. 404 when the slug matches neither a
  // curated tension nor any tension-tagged question in the bank.
  app.get("/api/tensions/:slug", async (req: Request, res: Response) => {
    let slug: string;
    try {
      slug = normalizeTensionSlug(req.params.slug);
    } catch (err) {
      if (err instanceof TensionInputError) {
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

      let catalogRow: TensionCatalogRow | null = null;
      let catalogReady = true;
      try {
        const rowQuery = buildTensionCatalogRowQuery(slug);
        const { rows } = await pool.query<TensionCatalogRow>(
          rowQuery.sql,
          rowQuery.values,
        );
        catalogRow = rows[0] ?? null;
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
        catalogReady = false;
      }

      const keys = tensionLinkKeys(slug, catalogRow?.tension_point_id ?? null);
      const examplesQuery = buildTensionExamplesQuery(keys, includeHidden);
      const subjectsQuery = buildTensionSubjectDistributionQuery(
        keys,
        includeHidden,
      );

      const [examples, subjects] = await Promise.all([
        pool.query<TensionExampleRow>(examplesQuery.sql, examplesQuery.values),
        pool.query<TensionSubjectRow>(subjectsQuery.sql, subjectsQuery.values),
      ]);

      const detail = shapeTensionDetail(
        slug,
        catalogRow,
        catalogReady,
        examples.rows,
        subjects.rows,
      );

      // Unknown tension: not curated and no question targets it. A curated tension
      // stays addressable even at zero coverage.
      if (
        !detail.official &&
        detail.examples.length === 0 &&
        detail.subject_distribution.length === 0
      ) {
        res.status(404).json({ error: "tension not found" });
        return;
      }

      res.json(detail);
    } catch (err) {
      console.error("[tension detail] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // GET /api/tensions/:slug/questions — paged questions targeted to the tension.
  app.get("/api/tensions/:slug/questions", async (req: Request, res: Response) => {
    let slug: string;
    try {
      slug = normalizeTensionSlug(req.params.slug);
    } catch (err) {
      if (err instanceof TensionInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const includeHidden = resolveIncludeHidden(
      req.query.include_hidden,
      config.nodeEnv,
    );
    const page = clampTensionPage(req.query.page);
    const limit = clampTensionQuestionsLimit(req.query.limit);
    const offset = (page - 1) * limit;

    try {
      const pool = getPool();

      // Resolve the canonical id so curated-slug URLs match bank tags by id too.
      let tensionPointId: string | null = null;
      try {
        const rowQuery = buildTensionCatalogRowQuery(slug);
        const { rows } = await pool.query<TensionCatalogRow>(
          rowQuery.sql,
          rowQuery.values,
        );
        tensionPointId = rows[0]?.tension_point_id ?? null;
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
      }

      const keys = tensionLinkKeys(slug, tensionPointId);
      const listQuery = buildTensionQuestionsQuery(
        keys,
        includeHidden,
        limit,
        offset,
      );
      const countQuery = buildTensionQuestionsCountQuery(keys, includeHidden);

      const [list, count] = await Promise.all([
        pool.query<TensionQuestionRow>(listQuery.sql, listQuery.values),
        pool.query<{ total: number | string }>(countQuery.sql, countQuery.values),
      ]);

      const total = Number(count.rows[0]?.total ?? 0);
      res.json(shapeTensionQuestions(slug, page, limit, total, list.rows));
    } catch (err) {
      console.error("[tension questions] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
