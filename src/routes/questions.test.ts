import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
// config.ts requires BARMATRIX_DB_KEY (not DATABASE_PASSWORD) and throws at
// import time if unset, which would crash this file before any test runs.
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

const {
  normalizeBySubjectParams,
  DEFAULT_BY_SUBJECT_LIMIT,
  MAX_BY_SUBJECT_LIMIT,
} = await import("./questions.js");

describe("normalizeBySubjectParams", () => {
  it("trims the subject and applies default pagination", () => {
    const params = normalizeBySubjectParams({ subject: "  Evidence  " });
    assert.equal(params.subject, "Evidence");
    assert.equal(params.page, 1);
    assert.equal(params.limit, DEFAULT_BY_SUBJECT_LIMIT);
    assert.equal(params.offset, 0);
  });

  it("returns a null subject for missing or blank values", () => {
    assert.equal(normalizeBySubjectParams({}).subject, null);
    assert.equal(normalizeBySubjectParams({ subject: "   " }).subject, null);
    assert.equal(normalizeBySubjectParams({ subject: 42 }).subject, null);
  });

  it("computes offset from page and limit", () => {
    const params = normalizeBySubjectParams({
      subject: "Torts",
      page: "3",
      limit: "10",
    });
    assert.equal(params.page, 3);
    assert.equal(params.limit, 10);
    assert.equal(params.offset, 20);
  });

  it("clamps the limit to the maximum and floors page at 1", () => {
    const params = normalizeBySubjectParams({
      subject: "Contracts",
      page: "0",
      limit: "5000",
    });
    assert.equal(params.page, 1);
    assert.equal(params.limit, MAX_BY_SUBJECT_LIMIT);
    assert.equal(params.offset, 0);
  });

  it("falls back to defaults for non-numeric pagination", () => {
    const params = normalizeBySubjectParams({
      subject: "Real Property",
      page: "abc",
      limit: "xyz",
    });
    assert.equal(params.page, 1);
    assert.equal(params.limit, DEFAULT_BY_SUBJECT_LIMIT);
  });
});
