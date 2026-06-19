import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPool } from "../db.js";
import {
  AtlasV1ValidationError,
  readAtlasV1Coverage,
  readAtlasV1Questions,
  setAtlasV1QuestionStatus,
  shapeAtlasV1Answer,
  submitAtlasV1Question,
  type AtlasV1AnswerRow,
  type AtlasV1CoverageState,
  type AtlasV1QuestionStatus,
} from "../lib/atlas-v1.js";

const questionStatus = z.enum(["review", "included", "rejected", "retired"]);
const coverageState = z.enum(["missing", "in_review", "covered"]);

const coverageQuery = z.object({
  subject: z.string().trim().min(1).max(128).optional(),
  subtopic: z.string().trim().min(1).max(255).optional(),
  coverage_state: coverageState.optional(),
  question_status: questionStatus.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const questionBody = z.object({
  question_id: z.string().trim().min(1).max(128).optional(),
  outline_code: z.string().trim().regex(/^[0-9]{8}$/),
  status: questionStatus.optional(),
  stem: z.string(),
  call_text: z.string(),
  answer_a: z.string(),
  answer_b: z.string(),
  answer_c: z.string(),
  answer_d: z.string(),
  correct_answer: z.string(),
  minimum_explanation: z.string(),
  source_label: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
  source_hash: z.string().nullable().optional(),
  case_study_json: z.unknown().optional(),
  included_by: z.string().nullable().optional(),
});

const statusBody = z.object({
  status: questionStatus,
  included_by: z.string().nullable().optional(),
});

const questionsQuery = z.object({
  outline_code: z.string().trim().regex(/^[0-9]{8}$/).optional(),
  status: questionStatus.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function requireAdminSecret(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "admin access not configured (ADMIN_SECRET not set)" });
    return false;
  }
  const provided = req.headers["x-admin-secret"];
  const candidate = Array.isArray(provided) ? provided[0] : provided;
  if (
    typeof candidate !== "string" ||
    Buffer.byteLength(candidate) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(candidate), Buffer.from(secret))
  ) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

function questionIdFromParams(req: Request): string | null {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return typeof id === "string" && id.trim().length > 0 && id.length <= 128 ? id : null;
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
  console.error(`[admin atlas_v1 ${label}] failed:`, err);
  res.status(500).json({ error: "internal server error" });
}

export function registerAdminAtlasV1Routes(app: Express): void {
  app.get("/api/admin/atlas-v1/coverage", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const parsed = coverageQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await readAtlasV1Coverage(getPool(), {
        subject: parsed.data.subject,
        subtopic: parsed.data.subtopic,
        coverageState: parsed.data.coverage_state as AtlasV1CoverageState | undefined,
        questionStatus: parsed.data.question_status as AtlasV1QuestionStatus | undefined,
        limit: parsed.data.limit,
      }));
    } catch (err) {
      handleAtlasError(err, res, "coverage");
    }
  });

  app.post("/api/admin/atlas-v1/questions", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const parsed = questionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.status(201).json(await submitAtlasV1Question(getPool(), parsed.data));
    } catch (err) {
      handleAtlasError(err, res, "question submit");
    }
  });

  app.get("/api/admin/atlas-v1/questions", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const parsed = questionsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await readAtlasV1Questions(getPool(), {
        outline_code: parsed.data.outline_code,
        status: parsed.data.status,
        limit: parsed.data.limit,
      }));
    } catch (err) {
      handleAtlasError(err, res, "questions list");
    }
  });

  app.patch("/api/admin/atlas-v1/questions/:id/status", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
    const id = questionIdFromParams(req);
    if (!id) {
      res.status(400).json({ error: "invalid question id" });
      return;
    }
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await setAtlasV1QuestionStatus(getPool(), {
        question_id: id,
        status: parsed.data.status,
        included_by: parsed.data.included_by,
      });
      if (!result.updated) {
        res.status(404).json({ error: "Atlas_v1 question not found" });
        return;
      }
      res.json(result);
    } catch (err) {
      handleAtlasError(err, res, "status");
    }
  });

  app.get("/api/admin/atlas-v1/questions/:id/answer", async (req: Request, res: Response) => {
    if (!requireAdminSecret(req, res)) return;
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
          LIMIT 1`,
        [id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Atlas_v1 question not found" });
        return;
      }
      res.json(shapeAtlasV1Answer(rows[0]));
    } catch (err) {
      handleAtlasError(err, res, "answer");
    }
  });
}
