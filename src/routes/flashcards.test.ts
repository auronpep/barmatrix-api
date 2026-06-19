import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult } from "../db.js";

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

const { recordFlashcardReviews } = await import("./flashcards.js");

describe("recordFlashcardReviews", () => {
  it("batches reviewed card inserts into one query", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const db = {
      query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
        calls.push({ sql, values });
        return { rows: [], rowCount: 2 };
      },
    };

    await recordFlashcardReviews(db, {
      studentId: "stu_1",
      deckId: "criminal-law-day1",
      cardIds: ["c01", "c02"],
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0]?.sql ?? "", /VALUES \(\$1, \$2, \$3, \$4\), \(\$5, \$6, \$7, \$8\)/);
    assert.equal(calls[0]?.values.length, 8);
    assert.equal(calls[0]?.values[1], "stu_1");
    assert.equal(calls[0]?.values[3], "c01");
    assert.equal(calls[0]?.values[7], "c02");
  });

  it("skips storage when no valid cards were reviewed", async () => {
    let calls = 0;
    const db = {
      query: async <T>(): Promise<QueryResult<T>> => {
        calls += 1;
        return { rows: [], rowCount: 0 };
      },
    };

    await recordFlashcardReviews(db, {
      studentId: "stu_1",
      deckId: "criminal-law-day1",
      cardIds: [],
    });

    assert.equal(calls, 0);
  });
});
