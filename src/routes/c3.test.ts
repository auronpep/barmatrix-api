import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Importing the route module pulls in db.js -> config.js, which validates env on
// load. Mirror me-red-zones.test.ts and provide placeholders so the import works.
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

const { shapeC3Response } = await import("./c3.js");

const MOLD_ROWS = [
  { mold_code: "bait_doctrine", family: "ISSUE_SENSE" as const, weight: 0.12, name: "Bait-doctrine",
    deck_ref: null, lesson_slug: "lesson-08", exposures: 10, bites: 3, w_exposure: 20, w_bite: 6 },
  { mold_code: "misfit", family: "ISSUE_SENSE" as const, weight: 0.10, name: "Misfit",
    deck_ref: null, lesson_slug: "lesson-08", exposures: 4, bites: 1, w_exposure: 6, w_bite: 1 },
];

describe("shapeC3Response", () => {
  it("reports coverage, families, weak molds (measured only), and not_yet_measured readiness path", () => {
    const r = shapeC3Response({
      molds: MOLD_ROWS,
      phases: [{ phase: "CUT", accuracy: 0.9, n: 30 }],
      families: [{ family: "ISSUE_SENSE", accuracy: 0.78, n: 14 }],
      cleanCut: { hit_rate: 0.86, n: 21 },
      calibration: [{ confidence: 5, actual: 0.7, n: 12 }],
      coverage: { total_attempts: 40, measured_attempts: 30 },
      subjects: [{ subject: "EVIDENCE", accuracy: 0.6, n: 10 }],
    });
    assert.equal(r.coverage.pct, 75);
    // only bait_doctrine is over the floor of 8
    assert.deepEqual(r.weak_molds.map((m) => m.mold_code), ["bait_doctrine"]);
    assert.equal(typeof r.readiness.score, "number");
    assert.equal(r.tracks.clean_cut_hit_rate, 0.86);
    assert.equal(r.tracks.calibration.direction, "overconfident");
  });

  it("empty attempts -> not_yet_measured everywhere, no throw", () => {
    const r = shapeC3Response({ molds: [], phases: [], families: [], cleanCut: { hit_rate: null, n: 0 },
      calibration: [], coverage: { total_attempts: 0, measured_attempts: 0 }, subjects: [] });
    assert.equal(r.readiness.score, null);
    assert.equal(r.coverage.pct, 0);
    assert.deepEqual(r.weak_molds, []);
  });
});
