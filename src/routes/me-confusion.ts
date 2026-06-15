// Authenticated Confusion analytics — the per-student view derived from the
// elimination tags captured on each attempt (attempt_choice_tags).
//
//   GET /api/me/confusion — lucky-guess rate, "eliminated the key" list, and the
//   top confusion pairs (the distractors a student keeps failing to separate from
//   the credited answer), enriched with the trap label.
//
// Auth mirrors routes/me-red-zones.ts: clerkMiddleware + a server-side Clerk->
// student resolver (never a client-supplied id). The aggregation is pure and
// lives in lib/confusion.ts (computeConfusionSignals); this file is just the
// query + wiring. The attempt_choice_tags table is founder-gated and may be
// absent — a missing table degrades to an empty (zeroed) payload, not a 500.

import type { Express, Request, RequestHandler, Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { getPool } from "../db.js";
import {
  computeConfusionSignals,
  type ConfusionTagJoinRow,
} from "../lib/confusion.js";
import { isMissingConfusionTable } from "./attempts.js";
import {
  resolveClerkStudent,
  type StudentResolution,
} from "../lib/me-student.js";

const MAX_TAG_ROWS = 4000;

function emptyConfusion() {
  return {
    enrolled: false,
    student_id: null as string | null,
    signals: {
      captured_attempts: 0,
      lucky_guess_count: 0,
      lucky_guess_rate: 0,
      eliminated_key_count: 0,
      coin_flip_wrong_count: 0,
      eliminated_key: [] as unknown[],
      top_confusion_pairs: [] as unknown[],
    },
  };
}

interface RegisterMeConfusionDeps {
  authMiddleware?: RequestHandler;
  resolveStudent?: (req: Request) => Promise<StudentResolution>;
}

export function registerMeConfusionRoutes(
  app: Express,
  deps: RegisterMeConfusionDeps = {},
): void {
  const authMiddleware = deps.authMiddleware ?? clerkMiddleware();
  const resolveStudent = deps.resolveStudent ?? resolveClerkStudent;

  app.get(
    "/api/me/confusion",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const resolution = await resolveStudent(req);
        if (resolution.kind === "unauthenticated") {
          res.status(401).json({ error: "not authenticated" });
          return;
        }
        if (resolution.kind === "clerk_error") {
          res.status(502).json({ error: "auth provider lookup failed" });
          return;
        }
        if (resolution.kind === "not_enrolled") {
          res.json(emptyConfusion());
          return;
        }

        const studentId = resolution.student.student_id;
        const pool = getPool();

        let rows: ConfusionTagJoinRow[];
        try {
          const result = await pool.query<ConfusionTagJoinRow>(
            `SELECT t.attempt_id,
                    t.choice_id,
                    t.bucket,
                    ac.is_correct        AS is_correct,
                    ac.letter            AS letter,
                    ac.forensic_tags     AS forensic_tags,
                    a.correct            AS attempt_correct,
                    q.external_id        AS external_id,
                    q.subject            AS subject,
                    q.subtopic           AS subtopic
               FROM attempt_choice_tags t
               JOIN student_attempts a ON a.attempt_id  = t.attempt_id
               JOIN answer_choices  ac ON ac.choice_id  = t.choice_id
               JOIN questions        q ON q.question_id = t.question_id
              WHERE a.student_id = $1
              ORDER BY a.attempted_at DESC
              LIMIT ${MAX_TAG_ROWS}`,
            [studentId],
          );
          rows = result.rows;
        } catch (err) {
          if (isMissingConfusionTable(err)) {
            // Table not provisioned yet — return a zeroed payload, not a 500.
            res.json({
              enrolled: resolution.student.enrolled,
              student_id: studentId,
              signals: emptyConfusion().signals,
            });
            return;
          }
          throw err;
        }

        res.json({
          enrolled: resolution.student.enrolled,
          student_id: studentId,
          signals: computeConfusionSignals(rows),
        });
      } catch (err) {
        console.error("[me confusion] failed:", err);
        res.status(500).json({ error: "internal server error" });
      }
    },
  );
}
