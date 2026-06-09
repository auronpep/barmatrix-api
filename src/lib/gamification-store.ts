// Transactional persistence for Boot Camp gamification. All scoring/streak/badge
// DECISIONS live in gamification.ts (pure + tested); this module only reads and
// writes. Runtime is MySQL/MariaDB; $N placeholders are converted by db.ts.

import { randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";
import {
  applyStreak,
  evaluateStreakBadges,
  utcToday,
  type BadgeSlug,
} from "./gamification.js";

export type XpSourceType =
  | "boot_camp_day"
  | "boot_camp_mastery"
  | "path_step" // J7 guided "lead me" path — one event per completed step
  | "day_plan_step"
  | "day_plan_main_item"
  | "day_plan_complete"
  | "catchup_step_complete";

export interface GamificationGrant {
  xp_earned: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  badges_unlocked: string[];
}

export interface GrantInput {
  studentId: string;
  sourceType: XpSourceType;
  sourceRef: string;
  xp: number;
  contentBadges: BadgeSlug[];
  now: Date;
}

/**
 * Record one boot-camp activity atomically: idempotent XP ledger insert (keyed
 * on source_ref), account-wide streak advance, and badge unlocks (content +
 * streak). Returns the deltas for the inline response. On any error the whole
 * transaction rolls back and the error propagates to the caller.
 */
export async function grantBootCampActivity(
  pool: DbPool,
  input: GrantInput,
): Promise<GamificationGrant> {
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");

    // 1. XP ledger — idempotent by (student_id, source_type, source_ref).
    // INSERT IGNORE (not SELECT-then-INSERT) so a concurrent re-grant of the
    // same source_ref is a no-op (affectedRows === 0), not a dup-key error.
    // The UNIQUE(student_id, source_type, source_ref) key enforces exactly-once.
    let xpEarned = 0;
    if (input.xp > 0) {
      const ins = await client.query(
        `INSERT IGNORE INTO student_xp_events (xp_event_id, student_id, source_type, source_ref, xp)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), input.studentId, input.sourceType, input.sourceRef, input.xp],
      );
      if (ins.rowCount === 1) xpEarned = input.xp;
    }

    // 2. Streak — read current row, advance via the pure helper, upsert.
    const today = utcToday(input.now);
    const gRows = await client.query<{
      current_streak: number;
      longest_streak: number;
      last_active_date: string | null;
    }>(
      `SELECT current_streak, longest_streak,
              DATE_FORMAT(last_active_date, '%Y-%m-%d') AS last_active_date
         FROM student_gamification
        WHERE student_id = $1`,
      [input.studentId],
    );
    const prev = gRows.rows[0] ?? {
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    };
    const streak = applyStreak(
      prev.last_active_date,
      today,
      Number(prev.current_streak),
      Number(prev.longest_streak),
    );
    await client.query(
      `INSERT INTO student_gamification
         (student_id, current_streak, longest_streak, last_active_date, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP(6))
       ON DUPLICATE KEY UPDATE
         current_streak = VALUES(current_streak),
         longest_streak = VALUES(longest_streak),
         last_active_date = VALUES(last_active_date),
         updated_at = VALUES(updated_at)`,
      [input.studentId, streak.current_streak, streak.longest_streak, today],
    );

    // 3. Badges — union content + streak; insert only the ones not already held.
    const candidate = [
      ...new Set<string>([...input.contentBadges, ...evaluateStreakBadges(streak.current_streak)]),
    ];
    let newlyUnlocked: string[] = [];
    if (candidate.length > 0) {
      const placeholders = candidate.map((_v, i) => `$${i + 2}`).join(", ");
      const have = await client.query<{ badge_slug: string }>(
        `SELECT badge_slug FROM student_badges
          WHERE student_id = $1 AND badge_slug IN (${placeholders})`,
        [input.studentId, ...candidate],
      );
      const held = new Set(have.rows.map((r) => r.badge_slug));
      newlyUnlocked = candidate.filter((slug) => !held.has(slug));
      for (const slug of newlyUnlocked) {
        await client.query(
          `INSERT IGNORE INTO student_badges (student_id, badge_slug) VALUES ($1, $2)`,
          [input.studentId, slug],
        );
      }
    }

    // 4. Total XP — sum the ledger (source of truth; no denormalized counter).
    const totalRows = await client.query<{ total: number | string }>(
      `SELECT COALESCE(SUM(xp), 0) AS total FROM student_xp_events WHERE student_id = $1`,
      [input.studentId],
    );

    await client.query("COMMIT");
    return {
      xp_earned: xpEarned,
      total_xp: Number(totalRows.rows[0]?.total ?? 0),
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      badges_unlocked: newlyUnlocked,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface GamificationProfile {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  badges: Array<{ slug: string; earned_at: string }>;
}

/** Read the account-wide gamification profile for a student. */
export async function readGamification(
  pool: DbPool,
  studentId: string,
): Promise<GamificationProfile> {
  const [g, total, badges] = await Promise.all([
    pool.query<{ current_streak: number; longest_streak: number }>(
      `SELECT current_streak, longest_streak FROM student_gamification WHERE student_id = $1`,
      [studentId],
    ),
    pool.query<{ total: number | string }>(
      `SELECT COALESCE(SUM(xp), 0) AS total FROM student_xp_events WHERE student_id = $1`,
      [studentId],
    ),
    pool.query<{ badge_slug: string; earned_at: string }>(
      `SELECT badge_slug, DATE_FORMAT(earned_at, '%Y-%m-%dT%H:%i:%sZ') AS earned_at
         FROM student_badges WHERE student_id = $1 ORDER BY earned_at ASC`,
      [studentId],
    ),
  ]);
  return {
    total_xp: Number(total.rows[0]?.total ?? 0),
    current_streak: Number(g.rows[0]?.current_streak ?? 0),
    longest_streak: Number(g.rows[0]?.longest_streak ?? 0),
    badges: badges.rows.map((r) => ({ slug: r.badge_slug, earned_at: r.earned_at })),
  };
}
