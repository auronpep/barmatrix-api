import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbClient, DbPool, QueryResult } from "../db.js";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.BARMATRIX_DB_KEY = "test_password";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP = "prod_placeholder";
process.env.STRIPE_PRICE_PAY_IN_FULL = "price_placeholder_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR = "price_placeholder_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO = "price_placeholder_two";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND = "price_two_second";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const {
  claimDiagnosticAttempts,
  collectClaimableDiagnosticIds,
} = await import("./claim-diagnostic.js");

type Call = { sql: string; values: readonly unknown[] };

function clientFor(calls: Call[]): DbClient {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("UPDATE student_attempts")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
}

describe("claim diagnostic attempts", () => {
  it("only reassigns attempts from the matching anonymous diagnostic owner", async () => {
    const calls: Call[] = [];

    await claimDiagnosticAttempts(
      clientFor(calls),
      "student-real",
      "31a57b60-6a31-11f1-a7ad-f9e8a06a2fad",
    );

    assert.match(calls[0]?.sql ?? "", /JOIN students s ON s\.student_id = a\.student_id/);
    assert.match(calls[0]?.sql ?? "", /s\.email = \$3/);
    assert.equal(
      calls[0]?.values[2],
      "anon-31a57b60-6a31-11f1-a7ad-f9e8a06a2fad@barmatrix.local",
    );
  });

  it("rethrows diagnostic lead lookup errors other than a missing table", async () => {
    const db: Pick<DbPool, "query"> = {
      query: async () => {
        throw Object.assign(new Error("ER_LOCK_DEADLOCK"), {
          code: "ER_LOCK_DEADLOCK",
        });
      },
    };

    await assert.rejects(
      () => collectClaimableDiagnosticIds(db, "student@example.com", null),
      /ER_LOCK_DEADLOCK/,
    );
  });
});
