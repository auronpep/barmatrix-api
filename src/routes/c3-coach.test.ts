import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Importing the route module pulls in db.js -> config.js, which validates env on
// load. Mirror c3.test.ts and provide placeholders so the import works, then
// import the pure helpers dynamically.
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

const { pickFromCandidates, buildCoachPayload } = await import("./c3-coach.js");

describe("pickFromCandidates", () => {
  it("returns the first candidate not in recently-seen", () => {
    assert.equal(pickFromCandidates(["q1", "q2", "q3"], new Set(["q1"])), "q2");
  });
  it("falls back to the first candidate when all are recently seen", () => {
    assert.equal(pickFromCandidates(["q1", "q2"], new Set(["q1", "q2"])), "q1");
  });
  it("returns null when there are no candidates", () => {
    assert.equal(pickFromCandidates([], new Set()), null);
  });
});

describe("buildCoachPayload", () => {
  const question = {
    question_id: "q9", external_id: "TR-1", subject: "TORTS", topic: null, subtopic: null,
    tension_point: null, fact_pattern: "fp", question_stem: "stem", call_of_question: null,
    choices: [{ choice_id: "c1", letter: "A", choice_text: "x" }],
  };
  it("assembles available payload with coaching + remediation", () => {
    const p = buildCoachPayload({
      question,
      mold: { mold_code: "half_truth", name: "Half-truth", family: "EAR_DISTORTION",
              lesson_slug: "lesson-09", deck_ref: "CARD-12", exposures: 11, bite_pct: 62, measured: true },
      deficit: 0.62, coverage: { total_attempts: 40, measured_attempts: 30 },
    });
    assert.equal(p.available, true);
    assert.equal(p.coaching.target_mold, "half_truth");
    assert.equal(p.coaching.deficit_pct, 62);
    assert.equal(p.coaching.measured, true);
    assert.equal(p.remediation.lesson_slug, "lesson-09");
    assert.equal(p.coverage.pct, 75);
    assert.equal(p.cohort_signal, null);
    assert.equal(p.coaching.fork_practice, false);
    assert.ok(!("is_correct" in p.question.choices[0]!));
  });

  it("marks fork_practice when injecting a hard-tail item", () => {
    const p = buildCoachPayload({
      question,
      mold: { mold_code: "fork", name: "Fork / Coin", family: "ISSUE_SENSE",
              lesson_slug: "lesson-10", deck_ref: null, exposures: 0, bite_pct: 0, measured: false },
      deficit: 0, coverage: { total_attempts: 40, measured_attempts: 30 },
      forkPractice: true,
    });
    assert.equal(p.coaching.fork_practice, true);
    assert.equal(p.coaching.target_mold, "fork");
  });
});
