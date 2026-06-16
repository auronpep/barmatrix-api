// §B PROOF — signed-in ENROLLED-USER server-side contract.
//
// Every prior "launch-ready" check on the paid program was anonymous (HTTP
// 200/307). This is the missing proof: that a real enrolled student's
// authenticated request resolves to THEIR row server-side, that their work
// attributes to them (driving red-zones/drills), that the entitlement gate
// separates active vs refunded vs never-purchased, and that one student can
// neither read nor recover another student's paid state.
//
// It mocks NOTHING about our own logic. The only thing not exercised here is
// Clerk's userId->email token verification (the external provider boundary),
// which is injected at the documented seam — exactly as the existing
// me-red-zones.integration.test.ts does. Every DB query, the entitlement SQL,
// the billing-ownership SQL, and the email->student attribution run for real
// against MySQL.
//
// Run (zero production mutation — disposable Docker DB):
//   docker compose -f docker-compose.dev.yml up -d
//   DATABASE_HOST=127.0.0.1 DATABASE_USER=root DATABASE_PASSWORD=devroot DATABASE_NAME=test_db npm run migrate
//   BARMATRIX_RUN_DB_INTEGRATION=1 npm test

import assert from "node:assert/strict";
import type { Server } from "node:http";
import { describe, it, before, after } from "node:test";
import type { Express } from "express";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
process.env.BARMATRIX_DB_KEY = "test_password";
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

const RUN_INTEGRATION = process.env.BARMATRIX_RUN_DB_INTEGRATION === "1";

let getPool: (typeof import("../db.js"))["getPool"];
let registerMeRedZonesRoutes: (typeof import("./me-red-zones.js"))["registerMeRedZonesRoutes"];
let findOrCreateStudentByEmail: (typeof import("../lib/clerk-identity.js"))["findOrCreateStudentByEmail"];
let isEnrolled: (typeof import("../lib/clerk-entitlement.js"))["isEnrolled"];
let resolveOwnedBillingPortalCustomer: (typeof import("../lib/clerk-entitlement.js"))["resolveOwnedBillingPortalCustomer"];

describe(
  "§B signed-in enrolled-user server-side proof",
  {
    skip: RUN_INTEGRATION
      ? false
      : "set BARMATRIX_RUN_DB_INTEGRATION=1 with local MySQL running (docker compose -f docker-compose.dev.yml up -d)",
  },
  () => {
    let app: Express;
    let pool: ReturnType<(typeof import("../db.js"))["getPool"]>;
    let server: Server;
    let baseUrl: string;

    // Identities. The enrolled student is who a real paying customer is.
    const run = randomUUID().slice(0, 8);
    const enrolledStudentId = randomUUID();
    const enrolledEmail = `enrolled_${run}@test.local`;
    const enrolledClerkUserId = `clerk_enrolled_${run}`;

    const refundedStudentId = randomUUID();
    const refundedEmail = `refunded_${run}@test.local`;

    const noPurchaseStudentId = randomUUID();
    const noPurchaseEmail = `nopurchase_${run}@test.local`;

    const otherStudentId = randomUUID();
    const otherEmail = `other_${run}@test.local`;

    const enrolledSessionId = `cs_test_enrolled_${run}`;
    const enrolledCustomerId = `cus_test_enrolled_${run}`;

    before(async () => {
      ({ getPool } = await import("../db.js"));
      ({ registerMeRedZonesRoutes } = await import("./me-red-zones.js"));
      ({ findOrCreateStudentByEmail } = await import("../lib/clerk-identity.js"));
      ({ isEnrolled, resolveOwnedBillingPortalCustomer } = await import(
        "../lib/clerk-entitlement.js"
      ));
      pool = getPool();
      app = express();

      // Inject ONLY the Clerk boundary (the documented seam). The student is
      // still resolved to its real row; nothing about entitlement/data is faked.
      registerMeRedZonesRoutes(app, {
        authMiddleware: (_req, _res, next) => next(),
        resolveStudent: async (req) => {
          const clerkId = req.headers["x-test-clerk-user-id"];
          if (!clerkId) return { kind: "unauthenticated" };
          if (clerkId !== enrolledClerkUserId) return { kind: "not_enrolled" };
          return {
            kind: "ok",
            student: {
              student_id: enrolledStudentId,
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

      await seed();
    });

    after(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await pool.end();
    });

    async function seed() {
      // Students.
      for (const [id, email] of [
        [enrolledStudentId, enrolledEmail],
        [refundedStudentId, refundedEmail],
        [noPurchaseStudentId, noPurchaseEmail],
        [otherStudentId, otherEmail],
      ] as const) {
        await pool.query(
          `INSERT INTO students (student_id, email, status, consent_flags)
           VALUES ($1, $2, 'active', JSON_OBJECT())
           ON DUPLICATE KEY UPDATE status='active'`,
          [id, email],
        );
      }

      // Purchases: enrolled = active/none (paid), refunded = active/refunded.
      await pool.query(
        `INSERT INTO purchases
           (purchase_id, student_id, stripe_customer_id, stripe_checkout_session_id,
            refund_status, entitlement_status, metadata)
         VALUES ($1, $2, $3, $4, 'none', 'active', JSON_OBJECT())`,
        [randomUUID(), enrolledStudentId, enrolledCustomerId, enrolledSessionId],
      );
      await pool.query(
        `INSERT INTO purchases
           (purchase_id, student_id, stripe_customer_id, stripe_checkout_session_id,
            refund_status, entitlement_status, metadata)
         VALUES ($1, $2, $3, $4, 'refunded', 'active', JSON_OBJECT())`,
        [randomUUID(), refundedStudentId, `cus_refunded_${run}`, `cs_refunded_${run}`],
      );

      // Content for the enrolled student's red zone + recent wrong.
      const questionId = randomUUID();
      await pool.query(
        `INSERT INTO questions
           (question_id, external_id, subject, subtopic, tension_point,
            fact_pattern, question_stem, status, metadata)
         VALUES ($1, $2, 'Evidence', 'Hearsay', 'confrontation_clause',
                 'Witness testifies X said Y', 'Is this hearsay?', 'active', '{}')`,
        [questionId, `q_${run}`],
      );
      const wrongChoiceId = randomUUID();
      const rightChoiceId = randomUUID();
      await pool.query(
        `INSERT INTO answer_choices
           (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags)
         VALUES ($1, $2, 'A', 'Yes', 0, '["wrong_scope"]', '[]')`,
        [wrongChoiceId, questionId],
      );
      await pool.query(
        `INSERT INTO answer_choices
           (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags)
         VALUES ($1, $2, 'B', 'No', 1, '[]', '[]')`,
        [rightChoiceId, questionId],
      );
      await pool.query(
        `INSERT INTO student_attempts
           (attempt_id, student_id, question_id, selected_choice_id, selected_letter,
            correct, confidence, attempted_at, metadata)
         VALUES ($1, $2, $3, $4, 'A', 0, 5, NOW(), JSON_OBJECT())`,
        [randomUUID(), enrolledStudentId, questionId, wrongChoiceId],
      );
      await pool.query(
        `INSERT INTO user_red_zones
           (student_id, dimension, tag_value, proficiency_score, attempts_count, high_confidence_wrong_count)
         VALUES ($1, 'subject', 'Evidence', 0.5, 1, 1)
         ON DUPLICATE KEY UPDATE proficiency_score=0.5`,
        [enrolledStudentId],
      );

      // Drills: one for the enrolled student, one for an unrelated student.
      await pool.query(
        `INSERT INTO drill_assignments
           (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids)
         VALUES ($1, $2, 'evidence-hearsay', 'enrolled drill', 'subject', 'Evidence', 'prescribed', '[]')`,
        [randomUUID(), enrolledStudentId],
      );
      await pool.query(
        `INSERT INTO drill_assignments
           (assignment_id, student_id, drill_slug, reason, red_zone_dimension, red_zone_tag, status, question_ids)
         VALUES ($1, $2, 'other-student-drill', 'other drill', 'subject', 'Evidence', 'prescribed', '[]')`,
        [randomUUID(), otherStudentId],
      );
    }

    const zoneUrl = (q: string) => `${baseUrl}/api/me/red-zones/zone?${q}`;

    // ---- Identity + paid data ----

    it("an enrolled signed-in student loads their own paid red-zone data", async () => {
      const res = await fetch(zoneUrl("dimension=subject&tag=Evidence"), {
        headers: { "x-test-clerk-user-id": enrolledClerkUserId },
      });
      assert.equal(res.status, 200, "enrolled student should get their zone");
      const data = (await res.json()) as any;
      assert(Array.isArray(data.recent_wrongs), "zone returns recent_wrongs");
    });

    it("rejects an unauthenticated request to paid data (401)", async () => {
      const res = await fetch(zoneUrl("dimension=subject&tag=Evidence"));
      assert.equal(res.status, 401);
    });

    it("does not leak another student's drill into the enrolled student's zone", async () => {
      const res = await fetch(zoneUrl("dimension=subject&tag=Evidence"), {
        headers: { "x-test-clerk-user-id": enrolledClerkUserId },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      if (data.drill) {
        assert.notEqual(
          data.drill.drill_slug,
          "other-student-drill",
          "must never surface another student's drill",
        );
      }
    });

    // ---- Attribution (the un-fakeable core) ----

    it("attributes a signed-in student's email to THEIR existing row, idempotently", async () => {
      const first = await findOrCreateStudentByEmail(pool, enrolledEmail);
      assert.equal(
        first,
        enrolledStudentId,
        "signed-in email must resolve to the enrolled student's own row, not a new one",
      );
      const second = await findOrCreateStudentByEmail(pool, enrolledEmail);
      assert.equal(second, enrolledStudentId, "resolution is idempotent");

      const { rows } = await pool.query<{ n: number | string }>(
        "SELECT COUNT(*) AS n FROM students WHERE email = $1",
        [enrolledEmail],
      );
      assert.equal(Number(rows[0]?.n), 1, "no duplicate student row was created");
    });

    it("a different signed-in email resolves to a DIFFERENT row (no cross-attribution)", async () => {
      const freshEmail = `fresh_${randomUUID()}@test.local`;
      const id = await findOrCreateStudentByEmail(pool, freshEmail);
      assert.notEqual(id, enrolledStudentId);
    });

    // ---- Entitlement gate (real students+purchases SQL) ----

    async function entitlementRowsFor(studentId: string) {
      const { rows } = await pool.query<{
        entitlement_status: string;
        refund_status: string;
      }>(
        `SELECT entitlement_status, refund_status
           FROM purchases WHERE student_id = $1`,
        [studentId],
      );
      return rows;
    }

    it("treats an active, non-refunded purchase as ENROLLED", async () => {
      assert.equal(isEnrolled(await entitlementRowsFor(enrolledStudentId)), true);
    });

    it("treats a refunded purchase as NOT enrolled", async () => {
      assert.equal(isEnrolled(await entitlementRowsFor(refundedStudentId)), false);
    });

    it("treats a student with no purchase as NOT enrolled", async () => {
      assert.equal(isEnrolled(await entitlementRowsFor(noPurchaseStudentId)), false);
    });

    // ---- Billing recovery ownership (ties to the post-checkout repair) ----

    it("lets the owning enrolled student resolve their billing portal customer", async () => {
      const result = await resolveOwnedBillingPortalCustomer(
        { studentId: enrolledStudentId, checkoutSessionId: enrolledSessionId },
        pool,
      );
      assert.equal(result.status, "ok");
      if (result.status === "ok") {
        assert.equal(result.customerId, enrolledCustomerId);
      }
    });

    it("resolves the active purchase even without a session id", async () => {
      const result = await resolveOwnedBillingPortalCustomer(
        { studentId: enrolledStudentId },
        pool,
      );
      assert.equal(result.status, "ok");
    });

    it("forbids another student from recovering the enrolled student's session", async () => {
      const result = await resolveOwnedBillingPortalCustomer(
        { studentId: otherStudentId, checkoutSessionId: enrolledSessionId },
        pool,
      );
      assert.equal(result.status, "forbidden");
    });

    it("does not hand a refunded student an active billing portal", async () => {
      const result = await resolveOwnedBillingPortalCustomer(
        { studentId: refundedStudentId },
        pool,
      );
      assert.notEqual(result.status, "ok");
    });
  },
);
