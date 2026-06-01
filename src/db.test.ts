import assert from "node:assert/strict";
import { describe, it } from "node:test";

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

const { toMysqlExecutionPlan, toMysqlQuery } = await import("./db.js");

describe("toMysqlQuery", () => {
  it("converts Postgres-style numbered placeholders to MySQL placeholders", () => {
    const converted = toMysqlQuery(
      "SELECT * FROM cohort_config WHERE cohort_code = $1 AND active = $2",
      ["JULY_MBE_REPAIR", true],
    );

    assert.equal(
      converted.sql,
      "SELECT * FROM cohort_config WHERE cohort_code = ? AND active = ?",
    );
    assert.deepEqual(converted.values, ["JULY_MBE_REPAIR", true]);
  });

  it("duplicates repeated numbered placeholder values in MySQL order", () => {
    const converted = toMysqlQuery(
      "SELECT $1 AS first_value, $2 AS second_value, $1 AS repeated_value",
      ["alpha", "beta"],
    );

    assert.equal(
      converted.sql,
      "SELECT ? AS first_value, ? AS second_value, ? AS repeated_value",
    );
    assert.deepEqual(converted.values, ["alpha", "beta", "alpha"]);
  });
});

describe("toMysqlExecutionPlan", () => {
  it("uses the simple query protocol for transaction control SQL", () => {
    const plan = toMysqlExecutionPlan("BEGIN");

    assert.equal(plan.sql, "BEGIN");
    assert.deepEqual(plan.values, []);
    assert.equal(plan.method, "query");
  });

  it("keeps bound placeholder values on the simple query protocol", () => {
    const plan = toMysqlExecutionPlan("SELECT * FROM questions WHERE question_id = $1", [
      "3c3a7993-5b90-11f1-a7ad-f9e8a06a2fad",
    ]);

    assert.equal(plan.sql, "SELECT * FROM questions WHERE question_id = ?");
    assert.deepEqual(plan.values, ["3c3a7993-5b90-11f1-a7ad-f9e8a06a2fad"]);
    assert.equal(plan.method, "query");
  });

  it("uses the simple query protocol for parameterized LIMIT/OFFSET SQL", () => {
    const plan = toMysqlExecutionPlan(
      `SELECT question_id FROM questions
         WHERE subject = $1 AND status = 'active'
         ORDER BY RAND()
         LIMIT $2 OFFSET $3`,
      ["Criminal Law", 6, 0],
    );

    assert.equal(plan.method, "query");
    assert.deepEqual(plan.values, ["Criminal Law", 6, 0]);
  });
});
