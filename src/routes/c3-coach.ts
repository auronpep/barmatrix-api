// GET /api/me/c3/next — the C3 Coach adaptive item endpoint. Thin: it wires DB
// rows into the pure selector (c3-bandit) + SM-2 (c3-srs). Missing-table tolerant
// and cold-start safe, mirroring routes/c3.ts.
import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import { moldStatsQuery, coverageQuery } from "../lib/c3-queries.js";
import { selectTarget, type Rng } from "../lib/c3-bandit.js";
import { isDue, type MoldSrs } from "../lib/c3-srs.js";
import { moldProficiency, type MoldRow, type Family } from "../lib/c3-scoring.js";
import {
  srsStateQuery, recentlySeenQuery,
  candidatesForMoldQuery, servableQuestionQuery, servableChoicesQuery,
} from "../lib/c3-coach-queries.js";

export interface ServableChoice { choice_id: string; letter: string; choice_text: string; }
export interface ServableQuestion {
  question_id: string; external_id: string | null; subject: string;
  topic: string | null; subtopic: string | null; tension_point: string | null;
  fact_pattern: string; question_stem: string; call_of_question: string | null;
  choices: ServableChoice[];
}

export interface CoachMoldMeta {
  mold_code: string; name: string; family: Family;
  lesson_slug: string | null; deck_ref: string | null;
  exposures: number; bite_pct: number; measured: boolean;
}

export interface BuildPayloadInput {
  question: ServableQuestion;
  mold: CoachMoldMeta;
  deficit: number;
  coverage: { total_attempts: number; measured_attempts: number };
}

export function pickFromCandidates(candidates: string[], recentlySeen: Set<string>): string | null {
  if (candidates.length === 0) return null;
  return candidates.find((q) => !recentlySeen.has(q)) ?? candidates[0]!;
}

export function buildCoachPayload(input: BuildPayloadInput) {
  const { question, mold, deficit, coverage } = input;
  const pct = coverage.total_attempts > 0
    ? Math.round((coverage.measured_attempts / coverage.total_attempts) * 100) : 0;
  return {
    available: true as const,
    coverage: { ...coverage, pct },
    question,
    coaching: {
      target_mold: mold.mold_code, name: mold.name, family: mold.family,
      deficit_pct: Math.round(deficit * 100), exposures: mold.exposures, measured: mold.measured,
    },
    remediation: { lesson_slug: mold.lesson_slug, deck_ref: mold.deck_ref },
    cohort_signal: null,
  };
}

const RECENTLY_SEEN_LIMIT = 25;
const CANDIDATE_POOL = 25;

function isMissingError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146 ||
                 e.code === "ER_BAD_FIELD_ERROR" || e.errno === 1054);
}
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const UNAVAILABLE = (reason: string) => ({ available: false as const, reason });

export function registerC3CoachRoutes(app: Express, rngFactory: () => Rng = () => Math.random): void {
  app.get("/api/me/c3/next", clerkMiddleware(), async (req: Request, res: Response) => {
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind === "unauthenticated") { res.status(401).json({ error: "not authenticated" }); return; }
    if (resolution.kind === "clerk_error") { res.status(502).json({ error: "auth provider lookup failed" }); return; }
    if (resolution.kind === "db_error") { res.status(500).json({ error: "internal server error" }); return; }
    if (resolution.kind === "not_enrolled") { res.json(UNAVAILABLE("not_enrolled")); return; }
    const sid = resolution.student.student_id;
    try {
      const pool = getPool();
      const [moldsR, srsR, seenR, covR] = await Promise.all([
        pool.query(moldStatsQuery(), [sid]),
        pool.query(srsStateQuery(), [sid]),
        pool.query(recentlySeenQuery(), [sid, RECENTLY_SEEN_LIMIT]),
        pool.query(coverageQuery(), [sid]),
      ]);

      const molds: MoldRow[] = (moldsR.rows as Record<string, unknown>[]).map((m) => ({
        mold_code: String(m.mold_code), family: m.family as Family, weight: num(m.weight),
        exposures: num(m.exposures), bites: num(m.bites),
        w_exposure: num(m.w_exposure), w_bite: num(m.w_bite),
      }));
      const metaByCode = new Map<string, { name: string; lesson_slug: string | null; deck_ref: string | null }>();
      for (const m of moldsR.rows as Record<string, unknown>[]) {
        metaByCode.set(String(m.mold_code), {
          name: (m.name as string) ?? String(m.mold_code),
          lesson_slug: (m.lesson_slug as string) ?? null, deck_ref: (m.deck_ref as string) ?? null,
        });
      }

      const srs = new Map<string, MoldSrs>();
      for (const r of srsR.rows as Record<string, unknown>[]) {
        srs.set(String(r.mold_code), {
          reps: num(r.reps), lapses: num(r.lapses), ease: Number(r.ease),
          interval_days: num(r.interval_days),
          last_reviewed_ms: Number(r.last_reviewed_ms),
          due_at_ms: Number(r.due_at_ms),
        });
      }
      const nowMs = Date.now();
      const srsDue: Record<string, boolean> = {};
      for (const m of molds) srsDue[m.mold_code] = isDue(srs, m.mold_code, nowMs);

      if (molds.length === 0) {
        const refMolds = await pool.query(
          `SELECT code AS mold_code, family, default_exam_weight AS weight,
                  name, lesson_slug, deck_ref FROM c3_molds`, []);
        if ((refMolds.rows as unknown[]).length === 0) { res.json(UNAVAILABLE("no_tagged_items")); return; }
        for (const m of refMolds.rows as Record<string, unknown>[]) {
          molds.push({ mold_code: String(m.mold_code), family: m.family as Family, weight: num(m.weight),
            exposures: 0, bites: 0, w_exposure: 0, w_bite: 0 });
          srsDue[String(m.mold_code)] = true;
          metaByCode.set(String(m.mold_code), { name: (m.name as string) ?? String(m.mold_code),
            lesson_slug: (m.lesson_slug as string) ?? null, deck_ref: (m.deck_ref as string) ?? null });
        }
      }

      const seen = new Set<string>((seenR.rows as Record<string, unknown>[]).map((r) => String(r.question_id)));
      const rng = rngFactory();
      const sel = selectTarget({ molds, srsDue, rng });

      let chosenQid: string | null = null;
      let chosenCode: string | null = null;
      for (const cand of sel.ranking) {
        const c = await pool.query(candidatesForMoldQuery(), [sid, cand.mold_code, CANDIDATE_POOL]);
        const ids = (c.rows as Record<string, unknown>[]).map((r) => String(r.question_id));
        const pick = pickFromCandidates(ids, seen);
        if (pick) { chosenQid = pick; chosenCode = cand.mold_code; break; }
      }
      if (!chosenQid || !chosenCode) { res.json(UNAVAILABLE("no_tagged_items")); return; }

      const [qR, chR] = await Promise.all([
        pool.query(servableQuestionQuery(), [chosenQid]),
        pool.query(servableChoicesQuery(), [chosenQid]),
      ]);
      if ((qR.rows as unknown[]).length === 0) { res.json(UNAVAILABLE("no_tagged_items")); return; }

      const row = molds.find((m) => m.mold_code === chosenCode)!;
      const prof = moldProficiency(row);
      const meta = metaByCode.get(chosenCode)!;
      const deficit = sel.ranking.find((r) => r.mold_code === chosenCode)?.deficit ?? 0;
      // Honest coverage denominator: coverageQuery LEFT JOINs so total counts ALL
      // attempts while measured counts only C3-annotated ones (events.length matches).
      const covRow = (covR.rows[0] ?? {}) as Record<string, unknown>;
      const total = num(covRow.total_attempts);
      const measured_attempts = num(covRow.measured_attempts);

      const payload = buildCoachPayload({
        question: { ...(qR.rows[0] as ServableQuestion), choices: chR.rows as ServableChoice[] },
        mold: {
          mold_code: chosenCode, name: meta.name, family: row.family,
          lesson_slug: meta.lesson_slug, deck_ref: meta.deck_ref,
          exposures: row.exposures, bite_pct: prof.bite_pct, measured: prof.measured,
        },
        deficit,
        coverage: { total_attempts: total, measured_attempts },
      });
      res.json(payload);
    } catch (err) {
      if (isMissingError(err)) { res.json(UNAVAILABLE("c3_not_provisioned")); return; }
      console.error("[c3-coach] /api/me/c3/next failed", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
