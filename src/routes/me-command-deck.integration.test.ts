import assert from "node:assert/strict";
import type { Server } from "node:http";
import { describe, it, before, after } from "node:test";
import type { Express } from "express";
import { randomUUID } from "node:crypto";

// Set up environment before importing db (mirrors me-red-zones.integration.test.ts).
// NOTE: requires a live test_db MariaDB on 127.0.0.1:3306. When no DB is
// reachable the before() hook throws and the suite reports 0 pass / 0 fail —
// same behavior as the repo's other integration tests.
process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP = "prod_placeholder";
process.env.STRIPE_PRICE_PAY_IN_FULL = "price_placeholder_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR = "price_placeholder_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO = "price_placeholder_two";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND = "price_placeholder_second";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";
process.env.NODE_ENV = "test";

const express = (await import("express")).default;
const { getPool } = await import("../db.js");
const { registerCommandDeckRoutes } = await import("./me-command-deck.js");

describe("GET /api/me/command-deck integration tests", () => {
  let app: Express;
  let pool: ReturnType<typeof getPool>;
  let server: Server;
  let baseUrl: string;
  const studentId = randomUUID();
  const clerkUserId = randomUUID();

  before(async () => {
    pool = getPool();
    app = express();

    registerCommandDeckRoutes(app, {
      authMiddleware: (_req, _res, next) => next(),
      resolveStudent: async (req) => {
        const clerkId = req.headers["x-test-clerk-user-id"];
        if (!clerkId) return { kind: "unauthenticated" };
        return {
          kind: "ok",
          student: {
            student_id: studentId,
            student_status: "active",
            enrolled: true,
            status: "active",
            refunded: false,
          },
        };
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("test server did not bind to a TCP port");
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    try {
      await setupTestData();
    } catch (err) {
      console.error("Failed to set up test data:", err);
      throw err;
    }
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  });

  async function setupTestData() {
    await pool.query(
      `INSERT INTO students (student_id, email, full_name, status, consent_flags)
       VALUES ($1, $2, 'Jordan Reyes', 'active', JSON_OBJECT())
       ON DUPLICATE KEY UPDATE status='active', full_name='Jordan Reyes'`,
      [studentId, `student${studentId}@test.local`],
    );

    // Two subjects: Evidence (wrong, tagged) + Torts (correct).
    const evQ = randomUUID();
    const ttQ = randomUUID();
    await pool.query(
      `INSERT INTO questions
       (question_id, external_id, subject, subtopic, tension_point,
        fact_pattern, question_stem, status, metadata)
       VALUES ($1, $2, 'Evidence', 'Hearsay', 'confrontation_clause',
               'fp', 'stem', 'active', '{}')
       ON DUPLICATE KEY UPDATE status='active'`,
      [evQ, `q_ev_${randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO questions
       (question_id, external_id, subject, subtopic, tension_point,
        fact_pattern, question_stem, status, metadata)
       VALUES ($1, $2, 'Torts', 'Negligence', 'proximate_cause',
               'fp', 'stem', 'active', '{}')
       ON DUPLICATE KEY UPDATE status='active'`,
      [ttQ, `q_tt_${randomUUID()}`],
    );

    const evWrongChoice = randomUUID();
    await pool.query(
      `INSERT INTO answer_choices
       (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags)
       VALUES ($1, $2, 'A', 'Wrong', 0, '["wrong_standard"]', '[]')
       ON DUPLICATE KEY UPDATE forensic_tags='["wrong_standard"]'`,
      [evWrongChoice, evQ],
    );

    // Today: one wrong Evidence attempt (tagged, high-confidence) + time_seconds.
    await pool.query(
      `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
        correct, confidence, time_seconds, attempted_at, metadata)
       VALUES ($1, $2, $3, $4, 'A', 0, 5, 600, NOW(), JSON_OBJECT())`,
      [randomUUID(), studentId, evQ, evWrongChoice],
    );
    // Today: one correct Torts attempt.
    await pool.query(
      `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
        correct, confidence, time_seconds, attempted_at, metadata)
       VALUES ($1, $2, $3, NULL, 'B', 1, 4, 300, NOW(), JSON_OBJECT())`,
      [randomUUID(), studentId, ttQ],
    );
    // Prior window (20 days ago): a Torts attempt, for the delta path.
    await pool.query(
      `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
        correct, confidence, time_seconds, attempted_at, metadata)
       VALUES ($1, $2, $3, NULL, 'C', 0, 3, 200, DATE_SUB(NOW(), INTERVAL 20 DAY), JSON_OBJECT())`,
      [randomUUID(), studentId, ttQ],
    );

    await pool.query(
      `INSERT INTO user_red_zones
       (student_id, dimension, tag_value, proficiency_score, attempts_count, high_confidence_wrong_count)
       VALUES ($1, 'subject', 'Evidence', 0.5, 2, 1)
       ON DUPLICATE KEY UPDATE proficiency_score=0.5`,
      [studentId],
    );

    await pool.query(
      `INSERT INTO drill_assignments
       (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids)
       VALUES ($1, $2, 'evidence-hearsay', 'Repair Evidence', 'subject', 'Evidence', 'prescribed', '[]')`,
      [randomUUID(), studentId],
    );
  }

  function deckUrl() {
    return `${baseUrl}/api/me/command-deck`;
  }

  it("returns a real command-deck payload for an enrolled student", async () => {
    const res = await fetch(deckUrl(), {
      headers: { "x-test-clerk-user-id": clerkUserId },
    });
    assert.equal(res.status, 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;

    assert.equal(data.enrolled, true);
    assert.equal(data.student.first_name, "Jordan");
    assert.equal(data.student.session_goal_min, 45);
    assert.ok(typeof data.student.streak_days === "number");
    assert.ok(data.student.session_done_min >= 15); // 600+300s today => >=15min

    assert.ok(Array.isArray(data.subject_mastery));
    const evMastery = data.subject_mastery.find(
      (m: { subject: string }) => m.subject === "Evidence",
    );
    assert.ok(evMastery, "Evidence mastery present");
    assert.equal(evMastery.pct, 0); // 0 of 1 correct in last 14d

    assert.ok(data.coverage, "coverage present");
    assert.ok(typeof data.coverage.pct === "number");
    assert.ok(data.coverage.bank_total >= 1); // seeded questions exist
    assert.ok(data.coverage.covered >= 1); // student attempted >=1 active question

    assert.ok(Array.isArray(data.red_zones));
    assert.ok(data.red_zones.length >= 1);
    assert.equal(data.red_zones[0].rank, 1);
    assert.equal(data.red_zones[0].drills_total, 1);

    assert.ok(Array.isArray(data.mastery_trend));
    assert.ok(data.mastery_trend.length >= 1);

    assert.ok(Array.isArray(data.recent_attempts));
    assert.ok(data.recent_attempts.length >= 2);

    assert.ok(data.next_up);
    assert.equal(data.next_up.subject, "Evidence");

    assert.ok("tension_matrix" in data); // null OR object, both valid
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(deckUrl());
    assert.equal(res.status, 401);
  });
});
