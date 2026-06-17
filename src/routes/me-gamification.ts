// Authenticated account-wide gamification profile — total XP, day-streak, and
// unlocked badges. Mirrors me-red-zones.ts: @clerk/express middleware, student
// resolved SERVER-SIDE from the Clerk email (never a client-supplied id).
//
//   GET /api/me/gamification

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import { readGamification } from "../lib/gamification-store.js";
import { BADGE_CATALOG, levelFromXp, type BadgeSlug } from "../lib/gamification.js";

function emptyProfile() {
  return {
    total_xp: 0,
    current_streak: 0,
    longest_streak: 0,
    level: levelFromXp(0),
    badges: [] as unknown[],
  };
}

export function registerMeGamificationRoutes(app: Express): void {
  app.get("/api/me/gamification", clerkMiddleware(), async (req: Request, res: Response) => {
    try {
      const resolution = await resolveClerkStudent(req);
      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (resolution.kind === "not_enrolled") {
        res.json(emptyProfile());
        return;
      }

      const profile = await readGamification(getPool(), resolution.student.student_id);
      res.json({
        total_xp: profile.total_xp,
        current_streak: profile.current_streak,
        longest_streak: profile.longest_streak,
        level: levelFromXp(profile.total_xp),
        badges: profile.badges.map((b) => {
          const meta = BADGE_CATALOG[b.slug as BadgeSlug];
          return {
            slug: b.slug,
            label: meta?.label ?? b.slug,
            description: meta?.description ?? "",
            emoji: meta?.emoji ?? "🏅",
            earned_at: b.earned_at,
          };
        }),
      });
    } catch (err) {
      console.error("[me-gamification] failed:", err);
      res.status(500).json({ error: "internal server error" });
    }
  });
}
