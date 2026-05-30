// C3 Certification routes. Auth + student via resolveClerkStudent (mirror me-red-zones.ts).
// Gate FAILS CLOSED: if foundations completion can't be verified, the cert stays locked.
// Answer keys live only in cert-keys.data.ts (server) and are returned only in the grade response.
import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import {
  getCertOutline, getPublicCompetency, getKeys, isValidCompetencyId,
  cooldownMsFor, overallStatus,
} from "../lib/cert.js";
import { gradeCompetency, type SubmittedAnswer } from "../lib/cert-grading.js";

const FOUNDATIONS_LESSON_COUNT = 14;

interface ResultRow { competency_id: string; passed: number; attempts_count: number; last_attempt_at: string | null; }

export function nextRetryAt(attemptsCount: number, lastAttemptAt: Date | null): string | null {
  const ms = cooldownMsFor(attemptsCount);
  if (ms === 0 || !lastAttemptAt) return null;
  return new Date(lastAttemptAt.getTime() + ms).toISOString();
}

export function shapeOutline(input: {
  lessonsCompleted: number; lessonCount: number; results: ResultRow[];
}) {
  const outline = getCertOutline();
  const unlocked = input.lessonsCompleted >= input.lessonCount;
  const byId = new Map(input.results.map((r) => [r.competency_id, r]));
  const passedById: Record<string, boolean> = {};
  const competencies = outline.competencies.map((c) => {
    const r = byId.get(c.id);
    passedById[c.id] = r?.passed === 1;
    return {
      id: c.id, title: c.title, capture: c.capture, pass: c.pass,
      status: r?.passed === 1 ? "passed" : r ? "not_yet" : "not_started",
      attempts: r?.attempts_count ?? 0,
      retry_at: r ? nextRetryAt(r.attempts_count, r.last_attempt_at ? new Date(r.last_attempt_at) : null) : null,
    };
  });
  return {
    title: outline.title, preview: outline.preview, preview_note: outline.preview_note,
    overall_gate: outline.overall_gate,
    lessons_completed: input.lessonsCompleted, lesson_count: input.lessonCount,
    unlocked, overall: unlocked ? overallStatus(passedById) : "NOT_YET", competencies,
  };
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

async function lessonsCompleted(studentId: string): Promise<number | null> {
  // FAIL CLOSED: a thrown/absent foundations_progress table -> null -> treat as locked.
  try {
    const { rows } = await getPool().query<{ n: number | string }>(
      "SELECT COUNT(*) AS n FROM foundations_progress WHERE student_id = $1 AND status = 'completed'",
      [studentId],
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

export function registerCertificationRoutes(app: Express): void {
  // Public outline (anonymous -> locked + zero progress); authed -> merged status.
  app.get("/api/certification", clerkMiddleware(), async (req: Request, res: Response) => {
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind === "unauthenticated" || resolution.kind === "not_enrolled") {
      res.json(shapeOutline({ lessonsCompleted: 0, lessonCount: FOUNDATIONS_LESSON_COUNT, results: [] }));
      return;
    }
    if (resolution.kind === "clerk_error") { res.status(502).json({ error: "auth provider lookup failed" }); return; }
    if (resolution.kind === "db_error") { res.status(500).json({ error: "internal server error" }); return; }
    try {
      const done = await lessonsCompleted(resolution.student.student_id);
      let results: ResultRow[] = [];
      try {
        const r = await getPool().query<ResultRow>(
          "SELECT competency_id, passed, attempts_count, last_attempt_at FROM cert_competency_results WHERE student_id = $1",
          [resolution.student.student_id]);
        results = r.rows;
      } catch (err) { if (!isMissingTable(err)) throw err; }
      res.json(shapeOutline({ lessonsCompleted: done ?? 0, lessonCount: FOUNDATIONS_LESSON_COUNT, results }));
    } catch (err) { console.error("[cert outline] failed:", err); res.status(500).json({ error: "internal server error" }); }
  });

  // Public per-competency content (no keys). Requires unlock.
  app.get("/api/certification/:competencyId", clerkMiddleware(), async (req: Request, res: Response) => {
    const id = req.params.competencyId;
    if (!isValidCompetencyId(id)) { res.status(400).json({ error: "invalid competency" }); return; }
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind !== "ok") { res.status(resolution.kind === "unauthenticated" ? 401 : 403).json({ error: "locked" }); return; }
    const done = await lessonsCompleted(resolution.student.student_id);
    if ((done ?? 0) < FOUNDATIONS_LESSON_COUNT) { res.status(403).json({ error: "complete The Method first" }); return; }
    const comp = getPublicCompetency(id);
    if (!comp) { res.status(404).json({ error: "not found" }); return; }
    res.json(comp);
  });

  // Start a timed session (server timestamp).
  app.post("/api/me/certification/:competencyId/start", clerkMiddleware(), async (req: Request, res: Response) => {
    const id = req.params.competencyId;
    if (!isValidCompetencyId(id)) { res.status(400).json({ error: "invalid competency" }); return; }
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind !== "ok") { res.status(resolution.kind === "unauthenticated" ? 401 : 403).json({ error: "not authorized" }); return; }
    try {
      const sessionId = randomUUID();
      await getPool().query(
        "INSERT INTO cert_sessions (session_id, student_id, competency_id) VALUES ($1,$2,$3)",
        [sessionId, resolution.student.student_id, id]);
      res.json({ session_id: sessionId });
    } catch (err) { console.error("[cert start] failed:", err); res.status(500).json({ error: "internal server error" }); }
  });

  // Submit + grade.
  app.post("/api/me/certification/:competencyId", clerkMiddleware(), async (req: Request, res: Response) => {
    const id = req.params.competencyId;
    if (!isValidCompetencyId(id)) { res.status(400).json({ error: "invalid competency" }); return; }
    const resolution = await resolveClerkStudent(req).catch(() => ({ kind: "db_error" }) as const);
    if (resolution.kind !== "ok") { res.status(resolution.kind === "unauthenticated" ? 401 : 403).json({ error: "not authorized" }); return; }
    const studentId = resolution.student.student_id;
    const keys = getKeys(id);
    if (!keys) { res.status(404).json({ error: "not found" }); return; }

    // Cooldown gate
    try {
      const { rows } = await getPool().query<{ attempts_count: number; last_attempt_at: string | null }>(
        "SELECT attempts_count, last_attempt_at FROM cert_competency_results WHERE student_id = $1 AND competency_id = $2",
        [studentId, id]);
      const prev = rows[0];
      if (prev) {
        const retry = nextRetryAt(prev.attempts_count, prev.last_attempt_at ? new Date(prev.last_attempt_at) : null);
        if (retry && new Date(retry).getTime() > new Date().getTime() + 1) { // server "now" comparison
          res.status(429).json({ error: "cooldown", retry_at: retry }); return;
        }
      }
    } catch (err) { if (!isMissingTable(err)) { console.error("[cert cooldown] failed:", err); res.status(500).json({ error: "internal server error" }); return; } }

    const answers = (req.body?.answers ?? []) as SubmittedAnswer[];
    if (!Array.isArray(answers)) { res.status(400).json({ error: "answers must be an array" }); return; }
    const result = gradeCompetency(keys, answers);

    try {
      await getPool().query(
        `INSERT INTO cert_competency_results
           (student_id, competency_id, passed, score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item, attempts_count, last_attempt_at, best_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,CURRENT_TIMESTAMP(6), CASE WHEN $3=1 THEN CURRENT_TIMESTAMP(6) ELSE NULL END)
         ON DUPLICATE KEY UPDATE
           attempts_count = attempts_count + 1,
           last_attempt_at = CURRENT_TIMESTAMP(6),
           -- best-wins: keep the higher score and a sticky pass
           passed = GREATEST(passed, VALUES(passed)),
           score = GREATEST(COALESCE(score,0), VALUES(score)),
           accuracy_score = GREATEST(COALESCE(accuracy_score,0), VALUES(accuracy_score)),
           phase_score = GREATEST(COALESCE(phase_score,0), VALUES(phase_score)),
           forks_passed = GREATEST(COALESCE(forks_passed,0), VALUES(forks_passed)),
           calibration_passed = GREATEST(COALESCE(calibration_passed,0), VALUES(calibration_passed)),
           per_item = VALUES(per_item),
           best_at = CASE WHEN VALUES(passed)=1 AND best_at IS NULL THEN CURRENT_TIMESTAMP(6) ELSE best_at END`,
        [studentId, id, result.passed ? 1 : 0, result.score,
         result.accuracy_score, result.forks_passed === null ? null : (result.forks_passed ? 1 : 0),
         result.phase_score, result.calibration_passed === null ? null : (result.calibration_passed ? 1 : 0),
         JSON.stringify({ v: 1, items: result.per_item })],
      );
    } catch (err) {
      if (isMissingTable(err)) { res.json({ persisted: false, ...result, remediation_lessons: keys.remediation_lessons }); return; }
      console.error("[cert submit] failed:", err); res.status(500).json({ error: "internal server error" }); return;
    }

    // recompute overall status
    let overall: "CONFIRMED" | "NOT_YET" = "NOT_YET";
    try {
      const { rows } = await getPool().query<{ competency_id: string; passed: number }>(
        "SELECT competency_id, passed FROM cert_competency_results WHERE student_id = $1", [studentId]);
      const passedById = Object.fromEntries(rows.map((r) => [r.competency_id, r.passed === 1]));
      overall = overallStatus(passedById);
    } catch { /* non-fatal */ }

    res.json({ persisted: true, passed: result.passed, score: result.score,
      conditions: { accuracy_score: result.accuracy_score, forks_passed: result.forks_passed, phase_score: result.phase_score, calibration_passed: result.calibration_passed },
      per_item: result.per_item, remediation_lessons: keys.remediation_lessons, overall });
  });
}
