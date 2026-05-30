// barmatrix-api/src/routes/certification.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Importing the route module pulls in db.js -> config.js, which validates env on
// load. Mirror c3.test.ts / me-red-zones.test.ts and provide placeholders.
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

const { shapeOutline, nextRetryAt } = await import("./certification.js");

describe("cert outline shaping", () => {
  it("locked when fewer than 14 lessons complete", () => {
    const o = shapeOutline({ lessonsCompleted: 10, lessonCount: 14, results: [] });
    assert.equal(o.unlocked, false);
    assert.equal(o.competencies.length, 10); // still lists them (locked)
  });
  it("unlocked at 14/14, merges results + overall status", () => {
    const results = ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10"].map((id) => ({
      competency_id: id, passed: 1, attempts_count: 1, last_attempt_at: "2026-05-30T00:00:00.000Z",
    }));
    const o = shapeOutline({ lessonsCompleted: 14, lessonCount: 14, results });
    assert.equal(o.unlocked, true);
    assert.equal(o.overall, "CONFIRMED");
  });
});
describe("nextRetryAt", () => {
  it("null on first attempt, set after attempts within cooldown", () => {
    assert.equal(nextRetryAt(0, new Date("2026-05-30T00:00:00Z")), null);
    const t = nextRetryAt(1, new Date("2026-05-30T00:00:00Z"));
    assert.equal(t, new Date("2026-05-30T01:00:00Z").toISOString()); // +1h
  });
});
