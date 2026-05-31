// Boot Camp endpoints — Web Component 05 (HANDOFFS/WEB/05-boot-camp.md).
//
// A boot camp is a multi-day repair sequence over a small set of tension/trap
// tags. Starting a camp pins each day's questions (deduped across days) plus a
// mastery set into a boot_camp_sessions row, so a student can pause and resume
// on the same questions and finish with a mastery check.
//
// Backing tables: boot_camps + boot_camp_sessions (SCHEMA_BOOT_CAMPS_MYSQL.sql).
// Question runner reuses /api/questions/:id + /api/attempts. Day-block attempts
// use set_id = session_id; the mastery set uses its own mastery_set_id so a
// question that appears both in a day and the mastery set is never double-counted.
//
// Pure math (pinning, scoring, advancement) lives in ../lib/bootcamps.ts.

import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool, type DbClient } from "../db.js";
import { config } from "../config.js";
import {
  computeMasteryScore,
  evaluateDayCompletion,
  flattenDayQuestionIds,
  isMasteryPassed,
  isMasteryUnlocked,
  nextCurrentDay,
  parseDayParam,
  pinDayQuestions,
  pinMasteryQuestions,
  summarizeDayProgress,
  type DayQuestionMap,
} from "../lib/bootcamps.js";
import { dayXp, evaluateDayContentBadges } from "../lib/gamification.js";
import { grantBootCampActivity, type GamificationGrant } from "../lib/gamification-store.js";
import {
  requireEnrolledResourceOwner,
  requireEnrollment,
} from "../lib/clerk-entitlement.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/i;

interface CampRow {
  boot_camp_id: string;
  slug: string;
  display_name: string;
  subject: string;
  description: string | null;
  day_count: number;
  questions_per_day: number;
  mastery_question_count: number;
  mastery_threshold: number | string;
  target_tensions: unknown;
  target_traps: unknown;
  status: string;
}

interface SessionRow {
  session_id: string;
  boot_camp_id: string;
  student_id: string;
  status: string;
  current_day: number;
  day_question_ids: unknown;
  mastery_set_id: string;
  mastery_question_ids: unknown;
  mastery_score: number | string | null;
}

interface QuestionIdRow {
  question_id: string;
}

interface AttemptRow {
  question_id: string;
  correct: number | boolean;
}

// Build sequential $N placeholders whose value order matches the values array,
// which is exactly what db.ts#toMysqlQuery expects ($N -> ? in appearance order).
function makeParams() {
  const values: unknown[] = [];
  const ph = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  const phList = (arr: readonly unknown[]): string => arr.map(ph).join(", ");
  return { values, ph, phList };
}

function asStringArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function asDayMap(value: unknown): DayQuestionMap {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  const out: DayQuestionMap = {};
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      out[key] = Array.isArray(val)
        ? val.filter((id): id is string => typeof id === "string")
        : [];
    }
  }
  return out;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isTruthy(value: number | boolean): boolean {
  return value === true || value === 1;
}

function statusList(includeHidden: boolean): string {
  // Literal, never user input — safe to interpolate. Hidden rows are only
  // visible outside production (founder gate 1 in Handoff 15).
  return includeHidden && config.nodeEnv !== "production"
    ? "'active','hidden'"
    : "'active'";
}

function campResponse(camp: CampRow) {
  return {
    slug: camp.slug,
    display_name: camp.display_name,
    subject: camp.subject,
    description: camp.description,
    day_count: Number(camp.day_count),
    questions_per_day: Number(camp.questions_per_day),
    mastery_question_count: Number(camp.mastery_question_count),
    mastery_threshold: Number(camp.mastery_threshold),
    target_tensions: asStringArray(camp.target_tensions),
    target_traps: asStringArray(camp.target_traps),
    status: camp.status,
  };
}

// Layered candidate selection: tag matches first, then a tension_point column
// fallback, then a subject fallback so a camp is never empty in dev when the
// bank's tags are sparse. Over-fetches per layer and dedupes to `limit`.
async function fetchCampPool(
  executor: { query: DbClient["query"] },
  camp: CampRow,
  limit: number,
  includeHidden: boolean,
): Promise<{ ids: string[]; usedFallback: boolean }> {
  const tensions = asStringArray(camp.target_tensions);
  const traps = asStringArray(camp.target_traps);
  const statuses = statusList(includeHidden);
  const collected: string[] = [];
  const seen = new Set<string>();
  let usedFallback = false;

  const add = (rows: QuestionIdRow[]): void => {
    for (const row of rows) {
      if (row.question_id && !seen.has(row.question_id)) {
        seen.add(row.question_id);
        collected.push(row.question_id);
      }
    }
  };

  // Layer A — question_tags (tension + trap-equivalent dimensions).
  if (tensions.length > 0 || traps.length > 0) {
    const p = makeParams();
    const ors: string[] = [];
    if (tensions.length > 0) {
      ors.push(`(qt.dimension = 'tension' AND qt.value IN (${p.phList(tensions)}))`);
    }
    if (traps.length > 0) {
      ors.push(
        `(qt.dimension IN ('trap','wrong_answer_architecture','misconception') AND qt.value IN (${p.phList(traps)}))`,
      );
    }
    const limitPh = p.ph(limit);
    const sql = `SELECT DISTINCT q.question_id
                   FROM questions q
                   JOIN question_tags qt ON qt.question_id = q.question_id
                  WHERE q.status IN (${statuses})
                    AND (${ors.join(" OR ")})
                  ORDER BY RAND()
                  LIMIT ${limitPh}`;
    const { rows } = await executor.query<QuestionIdRow>(sql, p.values);
    add(rows);
  }

  // Layer B — tension_point column fallback.
  if (collected.length < limit && tensions.length > 0) {
    const p = makeParams();
    const sql = `SELECT q.question_id
                   FROM questions q
                  WHERE q.status IN (${statuses})
                    AND q.tension_point IN (${p.phList(tensions)})
                  ORDER BY RAND()
                  LIMIT ${p.ph(limit)}`;
    const { rows } = await executor.query<QuestionIdRow>(sql, p.values);
    const before = collected.length;
    add(rows);
    if (collected.length > before) usedFallback = true;
  }

  // Layer C — subject fallback (last resort so dev/preview is never degenerate).
  if (collected.length < limit) {
    const p = makeParams();
    const sql = `SELECT q.question_id
                   FROM questions q
                  WHERE q.status IN (${statuses})
                    AND q.subject = ${p.ph(camp.subject)}
                  ORDER BY RAND()
                  LIMIT ${p.ph(limit)}`;
    const { rows } = await executor.query<QuestionIdRow>(sql, p.values);
    const before = collected.length;
    add(rows);
    if (collected.length > before) usedFallback = true;
  }

  return { ids: collected.slice(0, limit), usedFallback };
}

// Latest-attempt-wins map of question_id -> correct, scoped to one set_id and a
// fixed id list (so a day's attempts are isolated by question membership).
async function answeredMapForSet(
  executor: { query: DbClient["query"] },
  setId: string,
  questionIds: readonly string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (questionIds.length === 0) return map;
  const p = makeParams();
  const setPh = p.ph(setId);
  const idList = p.phList(questionIds);
  const { rows } = await executor.query<AttemptRow>(
    `SELECT a.question_id, a.correct
       FROM student_attempts a
      WHERE a.set_id = ${setPh} AND a.question_id IN (${idList})
      ORDER BY a.attempted_at ASC`,
    p.values,
  );
  for (const row of rows) {
    map.set(row.question_id, isTruthy(row.correct));
  }
  return map;
}


const startBody = z.object({
  include_hidden: z.boolean().optional(),
});

const dayCompleteBody = z.object({
  skip: z.boolean().optional(),
});

export function registerBootCampsRoutes(app: Express): void {
  // ---- Catalog ----
  app.get("/api/boot-camps", async (_req: Request, res: Response) => {
    try {
      const { rows } = await getPool().query<CampRow>(
        `SELECT boot_camp_id, slug, display_name, subject, description,
                day_count, questions_per_day, mastery_question_count,
                mastery_threshold, target_tensions, target_traps, status
           FROM boot_camps
          WHERE status = 'active'
          ORDER BY display_name ASC`,
      );
      res.json({ boot_camps: rows.map(campResponse) });
    } catch (err) {
      console.error("[boot-camps catalog] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  // ---- Session progress (registered before :slug so "sessions" is not a slug) ----
  app.get(
    "/api/boot-camps/sessions/:session_id",
    ...requireEnrollment(),
    async (req: Request, res: Response) => {
      await withSession(req, res, async ({ session, camp }) => {
        const pool = getPool();
        const dayMap = asDayMap(session.day_question_ids);
        const masteryIds = asStringArray(session.mastery_question_ids);
        const dayIds = flattenDayQuestionIds(dayMap);

        const dayAnswers = await answeredMapForSet(pool, session.session_id, dayIds);
        const masteryAnswers = await answeredMapForSet(
          pool,
          session.mastery_set_id,
          masteryIds,
        );

        const days = summarizeDayProgress(dayMap, Number(session.current_day), dayAnswers);
        const masteryAnswered = masteryAnswers.size;
        const masteryCorrect = [...masteryAnswers.values()].filter(Boolean).length;
        const threshold = Number(camp.mastery_threshold);
        const storedScore =
          session.mastery_score === null ? null : Number(session.mastery_score);

        res.json({
          session_id: session.session_id,
          slug: camp.slug,
          display_name: camp.display_name,
          subject: camp.subject,
          status: session.status,
          current_day: Number(session.current_day),
          day_count: Number(camp.day_count),
          mastery_threshold: threshold,
          days,
          mastery: {
            unlocked: isMasteryUnlocked(Number(session.current_day), Number(camp.day_count)),
            total: masteryIds.length,
            answered: masteryAnswered,
            correct: masteryCorrect,
            score: storedScore,
            passed: storedScore !== null && isMasteryPassed(storedScore, threshold),
          },
        });
      });
    },
  );

  // ---- Start a day's block (return pinned ids) ----
  app.post(
    "/api/boot-camps/sessions/:session_id/days/:day/start",
    ...requireEnrollment(),
    async (req: Request, res: Response) => {
      await withDay(req, res, async ({ session, day }) => {
        const dayMap = asDayMap(session.day_question_ids);
        if (day > Number(session.current_day)) {
          res.status(409).json({ error: "day_locked", current_day: Number(session.current_day) });
          return;
        }
        const dayIds = dayMap[String(day)] ?? [];
        // Resume support (acceptance #7): tell the runner which pinned questions
        // were already answered so it can land on the first unanswered one.
        const answers = await answeredMapForSet(getPool(), session.session_id, dayIds);
        res.json({
          session_id: session.session_id,
          day,
          set_id: session.session_id,
          question_ids: dayIds,
          answered_question_ids: [...answers.keys()],
          correct_count: [...answers.values()].filter(Boolean).length,
        });
      });
    },
  );

  // ---- Complete a day's block (advance current_day) ----
  app.post(
    "/api/boot-camps/sessions/:session_id/days/:day/complete",
    ...requireEnrollment(),
    async (req: Request, res: Response) => {
      const parsedBody = dayCompleteBody.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json({ error: parsedBody.error.flatten() });
        return;
      }
      const skip = parsedBody.data.skip === true;

      await withDay(req, res, async ({ session, day, camp }) => {
        const pool = getPool();
        const dayMap = asDayMap(session.day_question_ids);
        const dayIds = dayMap[String(day)] ?? [];
        const answers = await answeredMapForSet(pool, session.session_id, dayIds);
        const answered = answers.size;
        const correct = [...answers.values()].filter(Boolean).length;

        const evalResult = evaluateDayCompletion({
          correctCount: correct,
          answeredCount: answered,
          dayQuestionCount: dayIds.length,
        });

        const currentDay = Number(session.current_day);
        const dayCount = Number(camp.day_count);
        let advanced = false;
        let newCurrentDay = currentDay;

        if (evalResult.eligibleToAdvance || skip) {
          newCurrentDay = nextCurrentDay(currentDay, day, dayCount);
          if (newCurrentDay !== currentDay) {
            const upd = await pool.query(
              "UPDATE boot_camp_sessions SET current_day = $1 WHERE session_id = $2 AND current_day = $3",
              [newCurrentDay, session.session_id, currentDay],
            );
            // Exactly-once: a concurrent caller that already advanced this day
            // changes zero rows here and must not be treated as the advancer.
            advanced = upd.rowCount === 1;
          }
        }

        let gamification: GamificationGrant | null = null;
        if (advanced) {
          const skippedDay = skip && !evalResult.eligibleToAdvance;
          try {
            gamification = await grantBootCampActivity(pool, {
              studentId: session.student_id,
              sourceType: "boot_camp_day",
              sourceRef: `${session.session_id}:day:${day}`,
              xp: dayXp(correct, skippedDay),
              contentBadges: evaluateDayContentBadges({
                day,
                dayCount,
                correct,
                dayQuestionCount: dayIds.length,
              }),
              now: new Date(),
            });
          } catch (err) {
            // The day advancement is authoritative and already persisted; a
            // gamification failure must not lose it. Log and return null — the
            // grant is recoverable on the next idempotent completion call.
            console.error("[boot-camps] gamification grant (day) failed:", err);
          }
        }

        res.json({
          session_id: session.session_id,
          day,
          answered,
          correct,
          day_question_count: dayIds.length,
          passed: evalResult.passed,
          score: evalResult.score,
          advanced,
          skipped: skip && advanced && !evalResult.eligibleToAdvance,
          current_day: newCurrentDay,
          mastery_unlocked: isMasteryUnlocked(newCurrentDay, dayCount),
          gamification,
        });
      });
    },
  );

  // ---- Mastery start (ids already pinned at camp start) ----
  app.post(
    "/api/boot-camps/sessions/:session_id/mastery/start",
    ...requireEnrollment(),
    async (req: Request, res: Response) => {
      await withSession(req, res, async ({ session, camp }) => {
        if (!isMasteryUnlocked(Number(session.current_day), Number(camp.day_count))) {
          res.status(409).json({ error: "mastery_locked" });
          return;
        }
        res.json({
          session_id: session.session_id,
          set_id: session.mastery_set_id,
          question_ids: asStringArray(session.mastery_question_ids),
        });
      });
    },
  );

  // ---- Mastery complete (score + finalize, idempotent) ----
  app.post(
    "/api/boot-camps/sessions/:session_id/mastery/complete",
    ...requireEnrollment(),
    async (req: Request, res: Response) => {
      await withSession(req, res, async ({ session, camp }) => {
        const pool = getPool();
        const threshold = Number(camp.mastery_threshold);

        // Idempotency: once the camp is completed (passed), return the stored
        // result without re-applying. A not-yet-passed session can be retried —
        // recompute is safe because red-zone deltas are a snapshot read, not a
        // re-bump (so there is no double-count on retry).
        if (session.status === "completed" && session.mastery_score !== null) {
          const score = Number(session.mastery_score);
          res.json({
            session_id: session.session_id,
            mastery_score: score,
            mastered: isMasteryPassed(score, threshold),
            threshold,
            already_completed: true,
            red_zone_deltas: await redZoneSnapshot(pool, session.student_id, camp),
          });
          return;
        }

        const masteryIds = asStringArray(session.mastery_question_ids);
        const answers = await answeredMapForSet(pool, session.mastery_set_id, masteryIds);
        const correct = [...answers.values()].filter(Boolean).length;
        const total = masteryIds.length;
        const score = computeMasteryScore(correct, total);
        const mastered = isMasteryPassed(score, threshold);

        await pool.query(
          `UPDATE boot_camp_sessions
              SET mastery_score = $1,
                  status = $2,
                  completed_at = CASE WHEN $3 = 1 THEN CURRENT_TIMESTAMP(6) ELSE completed_at END
            WHERE session_id = $4`,
          [score, mastered ? "completed" : session.status, mastered ? 1 : 0, session.session_id],
        );

        res.json({
          session_id: session.session_id,
          mastery_score: score,
          mastered,
          threshold,
          correct,
          total,
          red_zone_deltas: await redZoneSnapshot(pool, session.student_id, camp),
        });
      });
    },
  );

  // ---- Detail + Start (slug routes LAST so they don't shadow /sessions) ----
  app.get("/api/boot-camps/:slug", async (req: Request, res: Response) => {
    const slug = req.params.slug;
    if (typeof slug !== "string" || slug === "sessions" || !SLUG_RE.test(slug)) {
      res.status(400).json({ error: "invalid slug" });
      return;
    }
    try {
      const camp = await loadCampBySlug(slug);
      if (!camp) {
        res.status(404).json({ error: "boot camp not found" });
        return;
      }
      const dayPlan = Array.from({ length: Number(camp.day_count) }, (_v, i) => ({
        day: i + 1,
        questions_per_day: Number(camp.questions_per_day),
      }));
      res.json({ ...campResponse(camp), day_plan: dayPlan });
    } catch (err) {
      console.error("[boot-camps detail] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  app.post("/api/boot-camps/:slug/start", ...requireEnrollment(), async (req: Request, res: Response) => {
    const slug = req.params.slug;
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
      res.status(400).json({ error: "invalid slug" });
      return;
    }
    const parsed = startBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const includeHidden = parsed.data.include_hidden === true;
    const studentId = res.locals.enrolledStudentId as string;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: campRows } = await client.query<CampRow>(
        `SELECT boot_camp_id, slug, display_name, subject, description,
                day_count, questions_per_day, mastery_question_count,
                mastery_threshold, target_tensions, target_traps, status
           FROM boot_camps WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      const camp = campRows[0];
      if (!camp) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "boot camp not found" });
        return;
      }

      // Resume: a known student already enrolled returns the existing session.
      const { rows: existingRows } = await client.query<SessionRow>(
        `SELECT session_id, boot_camp_id, student_id, status, current_day,
                day_question_ids, mastery_set_id, mastery_question_ids, mastery_score
           FROM boot_camp_sessions
          WHERE boot_camp_id = $1 AND student_id = $2
          LIMIT 1`,
        [camp.boot_camp_id, studentId],
      );
      if (existingRows[0]) {
        await client.query("COMMIT");
        const existing = existingRows[0];
        res.json({
          session_id: existing.session_id,
          slug: camp.slug,
          current_day: Number(existing.current_day),
          status: existing.status,
          resumed: true,
          partial: flattenDayQuestionIds(asDayMap(existing.day_question_ids)).length <
            Number(camp.day_count) * Number(camp.questions_per_day),
        });
        return;
      }

      const dayCount = Number(camp.day_count);
      const perDay = Number(camp.questions_per_day);
      const masteryCount = Number(camp.mastery_question_count);

      const dayPool = await fetchCampPool(client, camp, dayCount * perDay, includeHidden);
      const masteryPool = await fetchCampPool(client, camp, masteryCount, includeHidden);

      const pinned = pinDayQuestions(dayPool.ids, dayCount, perDay);
      const mastery = pinMasteryQuestions(masteryPool.ids, masteryCount);

      const sessionId = randomUUID();
      const masterySetId = randomUUID();

      await client.query(
        `INSERT INTO boot_camp_sessions
           (session_id, boot_camp_id, student_id, status, current_day,
            day_question_ids, mastery_set_id, mastery_question_ids, metadata)
         VALUES ($1, $2, $3, 'in_progress', 1, $4, $5, $6, $7)`,
        [
          sessionId,
          camp.boot_camp_id,
          studentId,
          JSON.stringify(pinned.days),
          masterySetId,
          JSON.stringify(mastery.mastery),
          JSON.stringify({ used_fallback: dayPool.usedFallback || masteryPool.usedFallback }),
        ],
      );

      await client.query("COMMIT");

      res.json({
        session_id: sessionId,
        slug: camp.slug,
        current_day: 1,
        status: "in_progress",
        resumed: false,
        partial: pinned.partial || mastery.partial,
        pinned_total: pinned.pinnedTotal,
        used_fallback: dayPool.usedFallback || masteryPool.usedFallback,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[boot-camps start] failed:", err);
      res.status(500).json({ error: "internal server error" });
    } finally {
      client.release();
    }
  });
}

// ---- shared loaders ----

async function loadCampBySlug(slug: string): Promise<CampRow | null> {
  const { rows } = await getPool().query<CampRow>(
    `SELECT boot_camp_id, slug, display_name, subject, description,
            day_count, questions_per_day, mastery_question_count,
            mastery_threshold, target_tensions, target_traps, status
       FROM boot_camps WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

interface SessionContext {
  session: SessionRow;
  camp: CampRow;
}

async function loadSessionContext(sessionId: string): Promise<SessionContext | null> {
  const { rows } = await getPool().query<SessionRow & CampRow>(
    `SELECT s.session_id, s.boot_camp_id, s.student_id, s.status, s.current_day,
            s.day_question_ids, s.mastery_set_id, s.mastery_question_ids, s.mastery_score,
            c.slug, c.display_name, c.subject, c.description, c.day_count,
            c.questions_per_day, c.mastery_question_count, c.mastery_threshold,
            c.target_tensions, c.target_traps, c.status AS camp_status
       FROM boot_camp_sessions s
       JOIN boot_camps c ON c.boot_camp_id = s.boot_camp_id
      WHERE s.session_id = $1
      LIMIT 1`,
    [sessionId],
  );
  const row = rows[0] as (SessionRow & CampRow & { camp_status: string }) | undefined;
  if (!row) return null;
  return {
    session: {
      session_id: row.session_id,
      boot_camp_id: row.boot_camp_id,
      student_id: row.student_id,
      status: row.status,
      current_day: row.current_day,
      day_question_ids: row.day_question_ids,
      mastery_set_id: row.mastery_set_id,
      mastery_question_ids: row.mastery_question_ids,
      mastery_score: row.mastery_score,
    },
    camp: {
      boot_camp_id: row.boot_camp_id,
      slug: row.slug,
      display_name: row.display_name,
      subject: row.subject,
      description: row.description,
      day_count: row.day_count,
      questions_per_day: row.questions_per_day,
      mastery_question_count: row.mastery_question_count,
      mastery_threshold: row.mastery_threshold,
      target_tensions: row.target_tensions,
      target_traps: row.target_traps,
      status: row.camp_status,
    },
  };
}

// Resolve a session (UUID-checked) and hand it to the handler, or write the
// appropriate 4xx. Keeps every session route's guard logic identical.
async function withSession(
  req: Request,
  res: Response,
  handler: (ctx: SessionContext) => Promise<void>,
): Promise<void> {
  const sessionId = req.params.session_id;
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    res.status(400).json({ error: "invalid session id" });
    return;
  }
  try {
    const ctx = await loadSessionContext(sessionId);
    if (!ctx) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    if (!requireEnrolledResourceOwner(res, ctx.session.student_id)) return;
    await handler(ctx);
  } catch (err) {
    console.error("[boot-camps session route] failed:", err);
    res.status(500).json({ error: "internal server error" });
  }
}

async function withDay(
  req: Request,
  res: Response,
  handler: (ctx: SessionContext & { day: number }) => Promise<void>,
): Promise<void> {
  await withSession(req, res, async (ctx) => {
    const day = parseDayParam(req.params.day, Number(ctx.camp.day_count));
    if (day === null) {
      res.status(400).json({ error: "invalid day" });
      return;
    }
    await handler({ ...ctx, day });
  });
}

// Post-mastery snapshot of the student's red zones for the camp's tensions.
// The per-attempt updates in /api/attempts already moved these, so this reads
// the current state rather than re-applying (avoids the double-count failure
// mode). Anonymous students have no red-zone rows, so this is [] for them.
async function redZoneSnapshot(
  executor: { query: DbClient["query"] },
  studentId: string,
  camp: CampRow,
): Promise<Array<{ dimension: string; tag: string; proficiency_score: number }>> {
  const tags = [
    ...asStringArray(camp.target_tensions),
    ...asStringArray(camp.target_traps),
  ];
  if (tags.length === 0) return [];
  const p = makeParams();
  const studentPh = p.ph(studentId);
  const tagList = p.phList(Array.from(new Set(tags)));
  try {
    const { rows } = await executor.query<{
      dimension: string;
      tag_value: string;
      proficiency_score: number | string;
    }>(
      `SELECT dimension, tag_value, proficiency_score
         FROM user_red_zones
        WHERE student_id = ${studentPh} AND tag_value IN (${tagList})`,
      p.values,
    );
    return rows.map((row) => ({
      dimension: row.dimension,
      tag: row.tag_value,
      proficiency_score: Number(row.proficiency_score),
    }));
  } catch (err) {
    console.error("[boot-camps red-zone snapshot] failed:", err);
    return [];
  }
}
