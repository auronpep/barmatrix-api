import assert from "node:assert/strict";
import test from "node:test";
import type { DbClient, QueryResult } from "../db.js";

for (const name of [
  "DATABASE_NAME",
  "DATABASE_USER",
  "BARMATRIX_DB_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRODUCT_BARMATRIX_FLAGSHIP",
  "STRIPE_PRICE_PAY_IN_FULL",
  "STRIPE_PRICE_FLAGSHIP_ANCHOR",
  "STRIPE_PRICE_PAY_IN_TWO",
  "STRIPE_PRICE_PAY_IN_TWO_SECOND",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "FRONTEND_URL",
  "SUCCESS_URL",
  "CANCEL_URL",
]) {
  process.env[name] ??= name.includes("URL") ? "http://localhost:3000" : "test";
}

const freeEnrollmentModule = import("./free-enrollment.js");

const campaign = {
  enabled: true,
  endsAt: "2026-07-30T07:00:00.000Z",
  campaign: "test_campaign",
};

test("free enrollment window honors enabled flag and end time", async () => {
  const { isFreeEnrollmentOpen } = await freeEnrollmentModule;
  assert.equal(
    isFreeEnrollmentOpen(campaign, new Date("2026-07-16T12:00:00.000Z")),
    true,
  );
  assert.equal(
    isFreeEnrollmentOpen(campaign, new Date("2026-07-30T07:00:00.000Z")),
    false,
  );
  assert.equal(isFreeEnrollmentOpen({ ...campaign, enabled: false }), false);
});

test("new Clerk account receives one complimentary active purchase", async () => {
  const { ensureComplimentaryEnrollment } = await freeEnrollmentModule;
  let activePurchaseChecks = 0;
  const statements: string[] = [];
  const client = mockClient(async (sql) => {
    statements.push(sql);
    if (sql.includes("SELECT student_id FROM students")) {
      return rows([{ student_id: "student_1" }]);
    }
    if (sql.includes("SELECT purchase_id") && sql.includes("FROM purchases")) {
      activePurchaseChecks += 1;
      return activePurchaseChecks === 1
        ? rows([])
        : rows([{ purchase_id: "purchase_1" }]);
    }
    if (sql.includes("SELECT cohort_id FROM cohort_config")) {
      return rows([{ cohort_id: "cohort_1" }]);
    }
    return rows([]);
  });

  const result = await ensureComplimentaryEnrollment(
    { userId: "user_new", email: "friend@example.com" },
    {
      db: { connect: async () => client },
      campaign,
      now: new Date("2026-07-16T12:00:00.000Z"),
      createId: () => "purchase_1",
      enrollInCohort: async () => undefined,
    },
  );

  assert.deepEqual(result, {
    studentId: "student_1",
    enrolled: true,
    granted: true,
  });
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO purchases")), true);
  assert.equal(statements.at(-1), "COMMIT");
});

test("existing active enrollment is preserved without another grant", async () => {
  const { ensureComplimentaryEnrollment } = await freeEnrollmentModule;
  const statements: string[] = [];
  const client = mockClient(async (sql) => {
    statements.push(sql);
    if (sql.includes("SELECT student_id FROM students")) {
      return rows([{ student_id: "student_paid" }]);
    }
    if (sql.includes("SELECT purchase_id") && sql.includes("FROM purchases")) {
      return rows([{ purchase_id: "purchase_paid" }]);
    }
    return rows([]);
  });

  const result = await ensureComplimentaryEnrollment(
    { userId: "user_paid", email: "paid@example.com" },
    { db: { connect: async () => client }, campaign },
  );

  assert.deepEqual(result, {
    studentId: "student_paid",
    enrolled: true,
    granted: false,
  });
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO purchases")), false);
});

function mockClient(
  query: (sql: string, values?: readonly unknown[]) => Promise<QueryResult<unknown>>,
): DbClient {
  return {
    query: query as DbClient["query"],
    release: () => undefined,
  };
}

function rows<T>(items: T[]): QueryResult<T> {
  return { rows: items, rowCount: items.length };
}
