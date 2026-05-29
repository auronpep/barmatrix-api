import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Importing the route module pulls in db.js -> config.js, which validates env on
// load. Mirror questions.test.ts and provide placeholders so the import works.
process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
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
  resolveDimensionColumn,
  subjectToDrillSlug,
  dominantSubject,
  deriveLibraryMetrics,
  compareDimensions,
  trapNameFrom,
  statusListSql,
} = await import("./me-red-zones.js");

describe("resolveDimensionColumn", () => {
  it("maps known dimensions to their question column", () => {
    assert.equal(resolveDimensionColumn("subject"), "subject");
    assert.equal(resolveDimensionColumn("subtopic"), "subtopic");
    assert.equal(resolveDimensionColumn("tension_point"), "tension_point");
  });

  it("returns null for unknown or empty dimensions", () => {
    assert.equal(resolveDimensionColumn("trap"), null);
    assert.equal(resolveDimensionColumn(""), null);
    assert.equal(resolveDimensionColumn("subject; DROP TABLE questions"), null);
  });
});

describe("subjectToDrillSlug", () => {
  it("matches the existing /drills route slugs", () => {
    assert.equal(subjectToDrillSlug("Evidence"), "evidence");
    assert.equal(subjectToDrillSlug("Real Property"), "real-property");
    assert.equal(subjectToDrillSlug("Civil Procedure"), "civil-procedure");
    assert.equal(subjectToDrillSlug("Constitutional Law"), "constitutional-law");
    assert.equal(subjectToDrillSlug("Criminal Law"), "criminal-law");
  });

  it("normalizes underscores, extra spaces, and punctuation", () => {
    assert.equal(subjectToDrillSlug("  Real_Property  "), "real-property");
    assert.equal(subjectToDrillSlug("Business Associations & Agency"), "business-associations-agency");
  });
});

describe("dominantSubject", () => {
  it("returns the most frequent non-null subject", () => {
    assert.equal(
      dominantSubject([
        { subject: "Evidence" },
        { subject: "Torts" },
        { subject: "Evidence" },
      ]),
      "Evidence",
    );
  });

  it("ignores null subjects and returns null when none present", () => {
    assert.equal(dominantSubject([{ subject: null }, { subject: null }]), null);
    assert.equal(dominantSubject([]), null);
  });
});

describe("deriveLibraryMetrics", () => {
  it("averages proficiency, counts active zones, sums HC wrongs", () => {
    const metrics = deriveLibraryMetrics([
      { proficiency_score: 0.5, high_confidence_wrong_count: 2 },
      { proficiency_score: 0.9, high_confidence_wrong_count: 1 },
      { proficiency_score: 0.6, high_confidence_wrong_count: 0 },
    ]);
    // avg = (0.5 + 0.9 + 0.6) / 3 = 0.6667 -> 67
    assert.equal(metrics.repair_progress_pct, 67);
    // below 0.7 threshold: 0.5 and 0.6 => 2
    assert.equal(metrics.active_red_zones, 2);
    assert.equal(metrics.high_confidence_wrongs, 3);
    assert.equal(metrics.total_zones, 3);
  });

  it("returns zeros for an empty zone list", () => {
    const metrics = deriveLibraryMetrics([]);
    assert.deepEqual(metrics, {
      repair_progress_pct: 0,
      active_red_zones: 0,
      high_confidence_wrongs: 0,
      total_zones: 0,
    });
  });
});

describe("compareDimensions", () => {
  it("orders known dimensions before unknown ones", () => {
    const sorted = ["zeta", "tension_point", "subject", "subtopic"].sort(
      compareDimensions,
    );
    assert.deepEqual(sorted, ["subject", "subtopic", "tension_point", "zeta"]);
  });
});

describe("trapNameFrom", () => {
  it("derives a trap label from the first non-correct forensic tag", () => {
    assert.equal(
      trapNameFrom(["correct_answer", "wrong_purpose"], "Hearsay"),
      "Wrong Purpose trap",
    );
  });

  it("parses JSON-string forensic tags", () => {
    assert.equal(trapNameFrom('["mismatched_party"]', null), "Mismatched Party trap");
  });

  it("falls back to subtopic, then a generic label", () => {
    assert.equal(trapNameFrom([], "Relevance"), "Relevance trap");
    assert.equal(trapNameFrom(null, null), "Wrong-answer trap");
    assert.equal(trapNameFrom(["correct_answer"], null), "Wrong-answer trap");
  });
});

describe("statusListSql", () => {
  it("emits a quoted, whitelisted IN-list", () => {
    assert.equal(statusListSql(["active"]), "'active'");
    assert.equal(statusListSql(["active", "hidden"]), "'active', 'hidden'");
  });

  it("drops non-whitelisted statuses and defaults to active", () => {
    assert.equal(statusListSql(["active", "deleted'; DROP"]), "'active'");
    assert.equal(statusListSql([]), "'active'");
    assert.equal(statusListSql(["bogus"]), "'active'");
  });
});
