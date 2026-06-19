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

const { isValidAttemptEventId } = await import("./attempt-feedback.js");

describe("isValidAttemptEventId", () => {
  it("accepts UUID attempt ids", () => {
    assert.equal(isValidAttemptEventId("11111111-2222-4333-8444-555555555555"), true);
  });

  it("rejects arbitrary short ids before ownership lookups", () => {
    assert.equal(isValidAttemptEventId("att_1"), false);
    assert.equal(isValidAttemptEventId("not-a-uuid"), false);
  });
});
