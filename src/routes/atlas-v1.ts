import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { requireEnrollment } from "../lib/clerk-entitlement.js";
import {
  AtlasV1ValidationError,
  extractAtlasV1DetourSpecs,
  readAtlasV1StudentCoverage,
  readAtlasV1StudentComponents,
  readAtlasV1StudentQuestions,
  readAtlasV1DetourTargetCounts,
  shapeAtlasV1Answer,
  shapeAtlasV1Detours,
  type AtlasV1AnswerRow,
} from "../lib/atlas-v1.js";

const coverageQuery = z.object({
  subject: z.string().trim().min(1).max(128).optional(),
  subtopic: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const questionsQuery = z.object({
  outline_code: z.string().trim().regex(/^[0-9]{8}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function questionIdFromParams(req: Request): string | null {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return typeof id === "string" && id.trim().length > 0 && id.length <= 128 ? id : null;
}

function codeFromParams(req: Request): string | null {
  const raw = req.params.code;
  const code = Array.isArray(raw) ? raw[0] : raw;
  return typeof code === "string" && /^[0-9]{8}$/.test(code) ? code : null;
}

function handleAtlasError(err: unknown, res: Response, label: string): void {
  if (err instanceof AtlasV1ValidationError) {
    res.status(400).json({ error: "validation failed", details: err.errors });
    return;
  }
  const e = err as { code?: unknown; errno?: unknown } | null;
  if (e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146)) {
    res.status(503).json({ error: "Atlas_v1 tables are not provisioned" });
    return;
  }
  console.error(`[atlas_v1 ${label}] failed:`, err);
  res.status(500).json({ error: "internal server error" });
}

export function registerAtlasV1Routes(app: Express): void {
  app.get("/api/atlas-v1/coverage", ...requireEnrollment(), async (req: Request, res: Response) => {
    const parsed = coverageQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await readAtlasV1StudentCoverage(getPool(), parsed.data));
    } catch (err) {
      handleAtlasError(err, res, "coverage");
    }
  });

  app.get("/api/atlas-v1/codes/:code/components", ...requireEnrollment(), async (req: Request, res: Response) => {
    const code = codeFromParams(req);
    if (!code) {
      res.status(400).json({ error: "invalid outline code" });
      return;
    }

    try {
      const components = await readAtlasV1StudentComponents(getPool(), { outline_code: code });
      if (!components) {
        res.status(404).json({ error: "Atlas_v1 outline code not found" });
        return;
      }
      res.json(components);
    } catch (err) {
      handleAtlasError(err, res, "components");
    }
  });

  app.get("/api/atlas-v1/questions", ...requireEnrollment(), async (req: Request, res: Response) => {
    const parsed = questionsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await readAtlasV1StudentQuestions(getPool(), parsed.data));
    } catch (err) {
      handleAtlasError(err, res, "questions");
    }
  });

  app.get("/api/atlas-v1/questions/:id/answer", ...requireEnrollment(), async (req: Request, res: Response) => {
    const id = questionIdFromParams(req);
    if (!id) {
      res.status(400).json({ error: "invalid question id" });
      return;
    }

    try {
      const { rows } = await getPool().query<AtlasV1AnswerRow>(
        `SELECT q.question_id, q.outline_code, n.outline_text, n.subject_display, n.subtopic,
                q.stem, q.call_text, q.answer_a, q.answer_b, q.answer_c, q.answer_d,
                q.correct_answer, q.minimum_explanation, q.case_study_json
           FROM atlas_questions q
           JOIN atlas_outline_nodes n
             ON n.code = q.outline_code
          WHERE q.question_id = $1
            AND q.status = 'included'
          LIMIT 1`,
        [id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Atlas_v1 question not found" });
        return;
      }
      const answer = shapeAtlasV1Answer(rows[0]);
      const specs = extractAtlasV1DetourSpecs(answer.case_study_modules.detours);
      const targetCounts = await readAtlasV1DetourTargetCounts(getPool(), specs);
      res.json({
        ...answer,
        detours: shapeAtlasV1Detours(specs, targetCounts, "student"),
      });
    } catch (err) {
      handleAtlasError(err, res, "answer");
    }
  });
}
