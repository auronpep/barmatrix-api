// GET /api/knowledge/search — read-only retrieval over the knowledge core.
//
// Every result carries provenance and review gates. This endpoint is for
// internal authoring/retrieval surfaces; it does not promote candidate content.

import type { Express, Request, Response } from "express";
import { getPool } from "../db.js";
import {
  buildKnowledgeSearchQuery,
  KnowledgeSearchInputError,
  normalizeKnowledgeSearch,
  shapeKnowledgeSearchResponse,
  type KnowledgeRow,
} from "../lib/knowledge.js";

export function registerKnowledgeRoutes(app: Express): void {
  app.get("/api/knowledge/search", async (req: Request, res: Response) => {
    let filters;
    try {
      filters = normalizeKnowledgeSearch(req.query as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KnowledgeSearchInputError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    try {
      const query = buildKnowledgeSearchQuery(filters);
      const { rows } = await getPool().query<KnowledgeRow>(query.sql, query.values);
      res.json(shapeKnowledgeSearchResponse(filters, rows));
    } catch (err) {
      console.error("[knowledge search] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
