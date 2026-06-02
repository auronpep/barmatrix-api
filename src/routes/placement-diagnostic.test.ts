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

const {
  PLACEMENT_LENGTH,
  confidencePctToBand,
  scorePlacementAttempt,
  shapePlacementStartResponse,
  shapePlacementResults,
} = await import("./placement-diagnostic.js");

describe("placement diagnostic helpers", () => {
  it("uses the 18-question placement contract", () => {
    assert.equal(PLACEMENT_LENGTH, 18);
  });

  it("starts with the exact hydrated question payloads selected for the session", () => {
    const response = shapePlacementStartResponse("session-1", [
      {
        question_id: "question-1",
        external_id: null,
        subject: "Evidence",
        topic: null,
        subtopic: "Hearsay",
        tension_point: null,
        fact_pattern: "Facts",
        question_stem: "Stem?",
        call_of_question: null,
        choices: [
          { choice_id: "choice-1", letter: "A", choice_text: "Answer A" },
        ],
      },
    ]);

    assert.equal(response.question_count, 1);
    assert.deepEqual(response.question_ids, ["question-1"]);
    assert.equal(response.questions[0]?.choices[0]?.letter, "A");
  });

  it("maps 0-100 placement confidence onto the attempts 1-5 band", () => {
    assert.equal(confidencePctToBand(0), 1);
    assert.equal(confidencePctToBand(1), 1);
    assert.equal(confidencePctToBand(20), 1);
    assert.equal(confidencePctToBand(21), 2);
    assert.equal(confidencePctToBand(100), 5);
  });

  it("scores legal correctness and calibration without requiring C3 mold storage", () => {
    assert.deepEqual(scorePlacementAttempt({ correct: true, confidencePct: 80 }), {
      legalScore: 1,
      mechanismScore: 1,
      calibrationScore: 1,
    });
    assert.deepEqual(scorePlacementAttempt({ correct: false, confidencePct: 25 }), {
      legalScore: 0,
      mechanismScore: 0,
      calibrationScore: 1,
    });
  });

  it("shapes placement results from recorded attempts", () => {
    const results = shapePlacementResults([
      {
        correct: true,
        subject: "Evidence",
        subtopic: "Hearsay",
        remediation_id: null,
        placement_legal_score: 1,
        placement_mechanism_score: 1,
        placement_calibration_score: 1,
      },
      {
        correct: false,
        subject: "Contracts",
        subtopic: "Offer",
        remediation_id: "offer-formation",
        placement_legal_score: 0,
        placement_mechanism_score: 0,
        placement_calibration_score: 1,
      },
    ]);

    assert.equal(results.attempts_so_far, 2);
    assert.equal(results.legal_score, 1);
    assert.equal(results.mechanism_score, 1);
    assert.equal(results.calibration_score, 2);
    assert.equal(results.total_score, 4);
    assert.deepEqual(results.subject_accuracy, [
      { subject: "Contracts", correct: 0, total: 1 },
      { subject: "Evidence", correct: 1, total: 1 },
    ]);
    assert.deepEqual(results.top_remediation_targets, [
      { subject: "Contracts", label: "Offer" },
    ]);
  });
});
