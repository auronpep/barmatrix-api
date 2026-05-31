import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import type { Express } from "express";

// Set up environment before importing db
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

import { randomUUID } from "node:crypto";
import express from "express";
import { getPool } from "../db.js";
import { registerMeRedZonesRoutes } from "./me-red-zones.js";


describe("GET /api/me/red-zones/zone integration tests", () => {
  let app: Express;
  let pool: ReturnType<typeof getPool>;
  const studentId = randomUUID();
  const studentId2 = randomUUID();
  const clerkUserId = randomUUID();

  before(async () => {
    pool = getPool();
    app = express();

    // Use mock clerk middleware for testing
    app.use((req: any, res, next) => {
      const clerkId = req.headers["x-test-clerk-user-id"];
      if (!clerkId) {
        res.status(401).json({ error: "not authenticated" });
        return;
      }
      req.auth = { userId: clerkId };
      next();
    });

    registerMeRedZonesRoutes(app);

    // Set up test data
    try {
      await setupTestData();
    } catch (err) {
      console.error("Failed to set up test data:", err);
      throw err;
    }
  });

  async function setupTestData() {
    // Create test student
    await pool.query(
      `INSERT INTO students (student_id, email, status, enrolled)
       VALUES ($1, $2, 'active', 1)
       ON DUPLICATE KEY UPDATE status='active'`,
      [studentId, `student${studentId}@test.local`],
    );

    // Create another student to test isolation
    await pool.query(
      `INSERT INTO students (student_id, email, status, enrolled)
       VALUES ($1, $2, 'active', 1)
       ON DUPLICATE KEY UPDATE status='active'`,
      [studentId2, `student${studentId2}@test.local`],
    );

    // Link student to Clerk user
    await pool.query(
      `UPDATE students SET clerk_user_id = $1 WHERE student_id = $2`,
      [clerkUserId, studentId],
    );

    // Create test questions: one active, one hidden
    const activeQuestionId = randomUUID();
    const hiddenQuestionId = randomUUID();

    await pool.query(
      `INSERT INTO questions
       (question_id, external_id, subject, subtopic, tension_point,
        fact_pattern, question_stem, status, metadata)
       VALUES ($1, $2, 'Evidence', 'Hearsay', 'confrontation_clause',
               'Witness testifies X said Y', 'Is this hearsay?', 'active', '{}')
       ON DUPLICATE KEY UPDATE status='active'`,
      [activeQuestionId, `q_active_${randomUUID()}`],
    );

    await pool.query(
      `INSERT INTO questions
       (question_id, external_id, subject, subtopic, tension_point,
        fact_pattern, question_stem, status, metadata)
       VALUES ($1, $2, 'Evidence', 'Hearsay', 'confrontation_clause',
               'Witness testifies X said Z', 'Is this hearsay?', 'hidden', '{}')
       ON DUPLICATE KEY UPDATE status='hidden'`,
      [hiddenQuestionId, `q_hidden_${randomUUID()}`],
    );

    // Create answer choices with forensic tags
    const activeChoiceId = randomUUID();
    const hiddenChoiceId = randomUUID();

    await pool.query(
      `INSERT INTO answer_choices
       (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags)
       VALUES ($1, $2, 'A', 'Yes', 0, '["wrong_scope"]', '[]')
       ON DUPLICATE KEY UPDATE forensic_tags='["wrong_scope"]'`,
      [activeChoiceId, activeQuestionId],
    );

    await pool.query(
      `INSERT INTO answer_choices
       (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags)
       VALUES ($1, $2, 'A', 'Yes', 0, '["wrong_foundation"]', '[]')
       ON DUPLICATE KEY UPDATE forensic_tags='["wrong_foundation"]'`,
      [hiddenChoiceId, hiddenQuestionId],
    );

    // Create wrong attempts for both questions
    await pool.query(
      `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter, correct, confidence, attempted_at)
       VALUES ($1, $2, $3, $4, 'A', 0, 5, NOW())`,
      [randomUUID(), studentId, activeQuestionId, activeChoiceId],
    );

    await pool.query(
      `INSERT INTO student_attempts
       (attempt_id, student_id, question_id, selected_choice_id, selected_letter, correct, confidence, attempted_at)
       VALUES ($1, $2, $3, $4, 'A', 0, 4, NOW())`,
      [randomUUID(), studentId, hiddenQuestionId, hiddenChoiceId],
    );

    // Create red zones for this student
    await pool.query(
      `INSERT INTO user_red_zones
       (student_id, dimension, tag_value, proficiency_score, attempts_count, high_confidence_wrong_count)
       VALUES ($1, 'subject', 'Evidence', 0.5, 2, 2)
       ON DUPLICATE KEY UPDATE proficiency_score=0.5`,
      [studentId],
    );

    // Create drill assignments: one active, one completed
    const activeDrillId = randomUUID();
    const completedDrillId = randomUUID();

    await pool.query(
      `INSERT INTO drill_assignments
       (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids)
       VALUES ($1, $2, 'evidence-hearsay', 'Testing active drill', 'subject', 'Evidence', 'prescribed', '[]')`,
      [activeDrillId, studentId],
    );

    await pool.query(
      `INSERT INTO drill_assignments
       (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids, completed_at)
       VALUES ($1, $2, 'evidence-old', 'Testing completed drill', 'subject', 'Evidence', 'completed', '[]', NOW())`,
      [completedDrillId, studentId],
    );
  }

  it("returns only ACTIVE wrong answers (excludes hidden questions)", async () => {
    const res = await fetch(
      "http://localhost:3001/api/me/red-zones/zone?dimension=subject&tag=Evidence",
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
        },
      },
    );

    assert.equal(res.status, 200, "request should succeed");
    const data = (await res.json()) as any;

    // Should have recent_wrongs with only the active question's attempt
    assert(Array.isArray(data.recent_wrongs), "recent_wrongs should be an array");

    // The hidden question's wrong answer should NOT be in the list
    const hiddenWrongs = data.recent_wrongs.filter((w: any) =>
      w.trap_name.includes("Wrong Foundation"),
    );
    assert.equal(
      hiddenWrongs.length,
      0,
      "recent_wrongs should NOT include wrong answers from hidden questions [BUG #2]",
    );

    // The active question's wrong answer SHOULD be in the list
    const activeWrongs = data.recent_wrongs.filter((w: any) =>
      w.trap_name.includes("Wrong Scope"),
    );
    assert.equal(
      activeWrongs.length,
      1,
      "recent_wrongs should include wrong answers from active questions",
    );
  });

  it("returns only ACTIVE drill assignments (excludes completed)", async () => {
    const res = await fetch(
      "http://localhost:3001/api/me/red-zones/zone?dimension=subject&tag=Evidence",
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
        },
      },
    );

    assert.equal(res.status, 200, "request should succeed");
    const data = (await res.json()) as any;

    // Should have a drill that is NOT completed
    if (data.drill) {
      assert.notEqual(
        data.drill.status,
        "completed",
        "drill should not be completed [BUG #1]",
      );
      assert(
        ["prescribed", "in_progress"].includes(data.drill.status),
        `drill status should be active (prescribed/in_progress), got ${data.drill.status}`,
      );
    }
  });

  it("isolates data: other students' drills are not visible", async () => {
    // Create a drill for student2
    await pool.query(
      `INSERT INTO drill_assignments
       (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids)
       VALUES ($1, $2, 'student2-drill', 'Student 2 drill', 'subject', 'Evidence', 'prescribed', '[]')`,
      [randomUUID(), studentId2],
    );

    const res = await fetch(
      "http://localhost:3001/api/me/red-zones/zone?dimension=subject&tag=Evidence",
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
        },
      },
    );

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;

    if (data.drill) {
      assert.notEqual(
        data.drill.drill_slug,
        "student2-drill",
        "should not see another student's drill",
      );
    }
  });

  it("validates dimension and tag parameters", async () => {
    const res = await fetch(
      "http://localhost:3001/api/me/red-zones/zone?dimension=invalid&tag=test",
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
        },
      },
    );

    assert.equal(res.status, 400, "invalid dimension should return 400");
    const data = (await res.json()) as any;
    assert(data.error, "should include error message");
  });

  it("requires authentication", async () => {
    const res = await fetch(
      "http://localhost:3001/api/me/red-zones/zone?dimension=subject&tag=Evidence",
    );

    assert.equal(res.status, 401, "unauthenticated request should return 401");
  });
});
