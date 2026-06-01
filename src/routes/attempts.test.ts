import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbClient, QueryResult } from "../db.js";

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

const { findSelectedChoiceForAttempt } = await import("./attempts.js");

class ScriptedChoiceClient implements Pick<DbClient, "query"> {
  calls: string[] = [];

  constructor(private readonly steps: Array<QueryResult<unknown> | Error>) {}

  async query<T>(sql: string): Promise<QueryResult<T>> {
    this.calls.push(sql);
    const step = this.steps.shift();
    assert.ok(step, `unexpected query: ${sql}`);
    if (step instanceof Error) throw step;
    return step as QueryResult<T>;
  }
}

function rows<T>(items: T[]): QueryResult<T> {
  return { rows: items, rowCount: items.length };
}

function missingC3MoldColumnError(): Error & {
  code: string;
  errno: number;
  sqlMessage: string;
} {
  const err = new Error("Unknown column 'c3_mold_code' in 'field list'") as Error & {
    code: string;
    errno: number;
    sqlMessage: string;
  };
  err.code = "ER_BAD_FIELD_ERROR";
  err.errno = 1054;
  err.sqlMessage = "Unknown column 'c3_mold_code' in 'field list'";
  return err;
}

describe("findSelectedChoiceForAttempt", () => {
  it("falls back when the optional C3 mold column is not provisioned", async () => {
    const client = new ScriptedChoiceClient([
      missingC3MoldColumnError(),
      rows([
        {
          choice_id: "choice_1",
          is_correct: 0,
          remediation_id: "general-principles",
        },
      ]),
    ]);

    const choice = await findSelectedChoiceForAttempt(
      client,
      "3c3a7993-5b90-11f1-a7ad-f9e8a06a2fad",
      "A",
    );

    assert.equal(client.calls.length, 2);
    assert.match(client.calls[0] ?? "", /c3_mold_code/);
    assert.doesNotMatch(client.calls[1] ?? "", /c3_mold_code/);
    assert.deepEqual(choice, {
      choice_id: "choice_1",
      is_correct: 0,
      remediation_id: "general-principles",
      c3_mold_code: null,
    });
  });
});
