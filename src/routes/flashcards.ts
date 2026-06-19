// J7 flashcards.
//
//   GET  /api/flashcards/:deckId            → deck metadata + cards (public content)
//   POST /api/me/flashcards/:deckId/complete → record reviewed cards (enrolled)
//
// Deck content is authored in src/lib/path-flashcards.data.ts. Only per-student
// review rows are stored (student_flashcard_reviews, founder-gated). XP for the
// flashcard PATH step is granted by POST /api/me/path/:stepId/complete (which reads
// the review count) — this route only records reviews, keeping XP in one path.

import type { Express, Request, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool, type DbPool } from "../db.js";
import { resolveClerkStudent } from "../lib/me-student.js";
import { getFlashcardDeck, shapeDeck } from "../lib/path-flashcards.data.js";

const completeBody = z.object({
  cards_reviewed: z.array(z.string().min(1).max(64)).max(200),
});

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146);
}

export async function recordFlashcardReviews(
  db: Pick<DbPool, "query">,
  input: { studentId: string; deckId: string; cardIds: string[] },
): Promise<void> {
  if (input.cardIds.length === 0) return;
  const values: unknown[] = [];
  const rows = input.cardIds.map((cardId, index) => {
    const start = index * 4;
    values.push(randomUUID(), input.studentId, input.deckId, cardId);
    return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
  });
  await db.query(
    `INSERT IGNORE INTO student_flashcard_reviews
       (review_id, student_id, deck_id, card_id)
     VALUES ${rows.join(", ")}`,
    values,
  );
}

export function registerFlashcardsRoutes(app: Express): void {
  // ---- public deck content ----
  app.get("/api/flashcards/:deckId", (req: Request, res: Response) => {
    const deckId = req.params.deckId;
    if (typeof deckId !== "string") {
      res.status(400).json({ error: "invalid deck id" });
      return;
    }
    const deck = getFlashcardDeck(deckId);
    if (!deck) {
      res.status(404).json({ error: "deck not found" });
      return;
    }
    res.json(shapeDeck(deck));
  });

  // ---- record reviews (enrolled) ----
  app.post(
    "/api/me/flashcards/:deckId/complete",
    clerkMiddleware(),
    async (req: Request, res: Response) => {
      const deckId = req.params.deckId;
      if (typeof deckId !== "string") {
        res.status(400).json({ error: "invalid deck id" });
        return;
      }
      const deck = getFlashcardDeck(deckId);
      if (!deck) {
        res.status(404).json({ error: "deck not found" });
        return;
      }
      const parse = completeBody.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten() });
        return;
      }

      const resolution = await resolveClerkStudent(req).catch(
        () => ({ kind: "db_error" }) as const,
      );
      if (resolution.kind === "unauthenticated") {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      if (resolution.kind === "clerk_error") {
        res.status(502).json({ error: "auth provider lookup failed" });
        return;
      }
      if (resolution.kind === "db_error") {
        res.status(500).json({ error: "internal server error" });
        return;
      }
      if (resolution.kind === "not_enrolled" || !("student" in resolution)) {
        res.status(403).json({ error: "not enrolled" });
        return;
      }

      // Only count cards that actually belong to the deck.
      const validIds = new Set(deck.cards.map((c) => c.card_id));
      const reviewed = Array.from(new Set(parse.data.cards_reviewed)).filter((id) =>
        validIds.has(id),
      );

      const studentId = resolution.student.student_id;
      const pool = getPool();
      try {
        await recordFlashcardReviews(pool, {
          studentId,
          deckId: deck.deck_id,
          cardIds: reviewed,
        });
      } catch (err) {
        if (isMissingTableError(err)) {
          res.json({
            deck_id: deck.deck_id,
            persisted: false,
            reason: "not_provisioned",
            reviewed: reviewed.length,
            card_count: deck.cards.length,
            complete: reviewed.length >= deck.cards.length,
          });
          return;
        }
        console.error("[flashcards complete] failed:", err);
        res.status(500).json({ error: "internal server error" });
        return;
      }

      // Re-read the distinct reviewed count so "complete" reflects all sessions.
      let total = reviewed.length;
      try {
        const { rows } = await pool.query<{ n: number | string }>(
          `SELECT COUNT(DISTINCT card_id) AS n
             FROM student_flashcard_reviews
            WHERE student_id = $1 AND deck_id = $2`,
          [studentId, deck.deck_id],
        );
        total = Number(rows[0]?.n ?? reviewed.length);
      } catch {
        // Fall back to this session's count.
      }

      res.json({
        deck_id: deck.deck_id,
        persisted: true,
        reviewed: total,
        card_count: deck.cards.length,
        complete: total >= deck.cards.length,
      });
    },
  );
}
