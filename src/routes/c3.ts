// C3 Mastery — flagship measurement surface.
//   GET /api/me/c3          — Clerk-gated; student server-derived; mastery payload.
//   GET /api/c3/deck        — public list of deck cards.
//   GET /api/c3/deck/:id    — public single card.
// Missing-table/column tolerant: an unprovisioned C3 layer degrades to not_yet_measured.
import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  moldStatsQuery, phaseAccuracyQuery, familyAccuracyQuery, cleanCutQuery,
  calibrationQuery, coverageQuery, subjectFacetQuery,
} from "../lib/c3-queries.js";
import {
  MOLD_FLOOR, moldProficiency, rollupFamilies, overallReadiness, calibrationError,
  type Family,
} from "../lib/c3-scoring.js";

function isMissingError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146 ||
                 e.code === "ER_BAD_FIELD_ERROR" || e.errno === 1054);
}

interface MoldStatRow {
  mold_code: string; family: Family; weight: number | string; name?: string;
  deck_ref?: string | null; lesson_slug?: string | null;
  exposures: number | string; bites: number | string;
  w_exposure: number | string | null; w_bite: number | string | null;
}

export interface ShapeInput {
  molds: Array<MoldStatRow & { name?: string; deck_ref?: string | null; lesson_slug?: string | null }>;
  phases: Array<{ phase: string; accuracy: number | string; n: number }>;
  families: Array<{ family: Family; accuracy: number | string; n: number }>;
  cleanCut: { hit_rate: number | string | null; n: number };
  calibration: Array<{ confidence: number; actual: number | string; n: number }>;
  coverage: { total_attempts: number | string; measured_attempts: number | string };
  subjects: Array<{ subject: string; accuracy: number | string; n: number }>;
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

export function shapeC3Response(input: ShapeInput) {
  const moldRows = input.molds.map((m) => ({
    mold_code: m.mold_code, family: m.family, weight: num(m.weight), name: m.name ?? m.mold_code,
    deck_ref: m.deck_ref ?? null, lesson_slug: m.lesson_slug ?? null,
    exposures: num(m.exposures), bites: num(m.bites), w_exposure: num(m.w_exposure), w_bite: num(m.w_bite),
  }));

  const families = rollupFamilies(moldRows);
  const readinessScore = overallReadiness(families);

  const weak_molds = moldRows
    .map((m) => ({ ...m, prof: moldProficiency(m) }))
    .filter((m) => m.prof.measured)
    .sort((a, b) => (a.prof.proficiency! - b.prof.proficiency!))
    .slice(0, 6)
    .map((m) => ({
      mold_code: m.mold_code, name: m.name, family: m.family, bite_pct: m.prof.bite_pct,
      exposures: m.exposures, deck_ref: m.deck_ref, lesson_slug: m.lesson_slug,
      proficiency: m.prof.proficiency,
    }));

  const total = num(input.coverage.total_attempts);
  const measured = num(input.coverage.measured_attempts);
  const phaseAcc: Record<string, number> = {};
  for (const p of input.phases) phaseAcc[p.phase] = round2(num(p.accuracy));
  const famAcc: Partial<Record<Family, number>> = {};
  for (const f of input.families) famAcc[f.family] = round2(num(f.accuracy));

  const calib = calibrationError(
    input.calibration.map((c) => ({ confidence: c.confidence, actual: num(c.actual), n: c.n })),
  );

  return {
    coverage: { measured_attempts: measured, total_attempts: total,
      pct: total > 0 ? Math.round((measured / total) * 100) : 0 },
    readiness: { score: readinessScore, label: readinessScore == null ? "not_yet_measured" : "measured",
      mold_floor: MOLD_FLOOR },
    families: families.map((f) => ({ family: f.family, proficiency: f.proficiency,
      measured_molds: f.measured_molds, accuracy: famAcc[f.family] ?? null })),
    tracks: {
      ear_overclaim: famAcc.EAR_OVERCLAIM ?? null,
      ear_falsity: famAcc.EAR_FALSITY ?? null,
      ear_distortion: famAcc.EAR_DISTORTION ?? null,
      issue_sense: famAcc.ISSUE_SENSE ?? null,
      phase_accuracy: phaseAcc,
      clean_cut_hit_rate: input.cleanCut.hit_rate == null ? null : round2(num(input.cleanCut.hit_rate)),
      calibration: calib,
    },
    weak_molds,
    facets: { by_subject: input.subjects.map((s) => ({ subject: s.subject, accuracy: round2(num(s.accuracy)), n: s.n })) },
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

const EMPTY = (): ReturnType<typeof shapeC3Response> =>
  shapeC3Response({ molds: [], phases: [], families: [], cleanCut: { hit_rate: null, n: 0 },
    calibration: [], coverage: { total_attempts: 0, measured_attempts: 0 }, subjects: [] });

export function registerC3Routes(app: Express): void {
  app.get("/api/me/c3", clerkMiddleware(), async (req: Request, res: Response) => {
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind === "unauthenticated") { res.status(401).json({ error: "not authenticated" }); return; }
    if (resolution.kind === "clerk_error") { res.status(502).json({ error: "auth provider lookup failed" }); return; }
    if (resolution.kind === "db_error") { res.status(500).json({ error: "internal server error" }); return; }
    if (resolution.kind === "not_enrolled") { res.json(EMPTY()); return; }

    const sid = resolution.student.student_id;
    try {
      const pool = getPool();
      // c3-queries select c3_molds columns; join name/deck_ref/lesson_slug for weak-mold display.
      const moldSql = moldStatsQuery().replace(
        "SELECT m.code AS mold_code, m.family AS family, m.default_exam_weight AS weight,",
        "SELECT m.code AS mold_code, m.family AS family, m.default_exam_weight AS weight, m.name AS name, m.deck_ref AS deck_ref, m.lesson_slug AS lesson_slug,",
      ).replace("GROUP BY m.code, m.family, m.default_exam_weight",
                "GROUP BY m.code, m.family, m.default_exam_weight, m.name, m.deck_ref, m.lesson_slug");
      const [molds, phases, families, cleanCut, calibration, coverage, subjects] = await Promise.all([
        pool.query(moldSql, [sid]),
        pool.query(phaseAccuracyQuery(), [sid]),
        pool.query(familyAccuracyQuery(), [sid]),
        pool.query(cleanCutQuery(), [sid]),
        pool.query(calibrationQuery(), [sid]),
        pool.query(coverageQuery(), [sid]),
        pool.query(subjectFacetQuery(), [sid]),
      ]);
      res.json(shapeC3Response({
        molds: molds.rows as ShapeInput["molds"],
        phases: phases.rows as ShapeInput["phases"],
        families: families.rows as ShapeInput["families"],
        cleanCut: (cleanCut.rows[0] as ShapeInput["cleanCut"]) ?? { hit_rate: null, n: 0 },
        calibration: calibration.rows as ShapeInput["calibration"],
        coverage: (coverage.rows[0] as ShapeInput["coverage"]) ?? { total_attempts: 0, measured_attempts: 0 },
        subjects: subjects.rows as ShapeInput["subjects"],
      }));
    } catch (err) {
      if (isMissingError(err)) { res.json(EMPTY()); return; }
      console.error("[me c3] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/c3/deck", async (_req: Request, res: Response) => {
    try {
      const { rows } = await getPool().query(
        "SELECT card_id, type, subject, front, is_fork FROM c3_cards ORDER BY card_id");
      res.json({ cards: rows });
    } catch (err) {
      if (isMissingError(err)) { res.json({ cards: [] }); return; }
      console.error("[c3 deck] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.get("/api/c3/deck/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !/^[A-Z]+-\d{2}$/.test(id)) { res.status(400).json({ error: "invalid card id" }); return; }
    try {
      const { rows } = await getPool().query(
        "SELECT card_id, type, subject, front, back, trap_or_axis, is_fork FROM c3_cards WHERE card_id = $1",
        [id]);
      if (rows.length === 0) { res.status(404).json({ error: "card not found" }); return; }
      res.json(rows[0]);
    } catch (err) {
      if (isMissingError(err)) { res.status(404).json({ error: "card not found" }); return; }
      console.error("[c3 card] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
