import assert from "node:assert/strict";
import { describe, it } from "node:test";

// drills.ts imports db.ts -> config.ts, which fails loud unless these are set.
// Mirror questions.test.ts so the pure helpers can be imported without a DB.
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
  masteryResult,
  mapDimensionToColumn,
  humanizeTag,
  normalizeStartInput,
  redZoneTargetFor,
  reasonFor,
  drillNameFor,
  DrillInputError,
  DEFAULT_DRILL_SIZE,
  MIN_DRILL_SIZE,
  MAX_DRILL_SIZE,
  MASTERY_THRESHOLD,
} = await import("./drills.js");

describe("masteryResult", () => {
  it("is not mastered with zero total (no NaN)", () => {
    assert.deepEqual(masteryResult(0, 0), { mastered: false, ratio: 0 });
  });
  it("masters at the 9/12 (0.75) threshold", () => {
    const r = masteryResult(9, 12);
    assert.equal(r.mastered, true);
    assert.equal(r.ratio, 0.75);
  });
  it("does not master at 8/12", () => {
    assert.equal(masteryResult(8, 12).mastered, false);
  });
  it("uses MASTERY_THRESHOLD = 0.75 by default", () => {
    assert.equal(MASTERY_THRESHOLD, 0.75);
  });
});

describe("mapDimensionToColumn", () => {
  it("maps tracked dimensions to their question column", () => {
    assert.equal(mapDimensionToColumn("subject"), "subject");
    assert.equal(mapDimensionToColumn("subtopic"), "subtopic");
    assert.equal(mapDimensionToColumn("tension_point"), "tension_point");
  });
  it("returns null for untracked dimensions", () => {
    assert.equal(mapDimensionToColumn("wrong_answer_architecture"), null);
    assert.equal(mapDimensionToColumn(null), null);
    assert.equal(mapDimensionToColumn(undefined), null);
  });
});

describe("humanizeTag", () => {
  it("title-cases snake_case and kebab-case tags", () => {
    assert.equal(humanizeTag("effect_on_listener"), "Effect On Listener");
    assert.equal(humanizeTag("purpose-of-offer"), "Purpose Of Offer");
  });
  it("handles empty / null", () => {
    assert.equal(humanizeTag(""), "");
    assert.equal(humanizeTag(null), "");
  });
});

describe("normalizeStartInput", () => {
  it("defaults size to 12 and trims a tension slug", () => {
    const r = normalizeStartInput({ kind: "tension", slug: "  effect_on_listener " });
    assert.equal(r.kind, "tension");
    assert.equal(r.slug, "effect_on_listener");
    assert.equal(r.size, DEFAULT_DRILL_SIZE);
  });
  it("requires a slug for tension/trap drills", () => {
    assert.throws(() => normalizeStartInput({ kind: "tension" }), DrillInputError);
    assert.throws(() => normalizeStartInput({ kind: "trap", slug: "" }), DrillInputError);
  });
  it("requires dimension + tag for prescribed_red_zone drills", () => {
    assert.throws(
      () => normalizeStartInput({ kind: "prescribed_red_zone", red_zone_tag: "x" }),
      DrillInputError,
    );
    const r = normalizeStartInput({
      kind: "prescribed_red_zone",
      red_zone_dimension: "subtopic",
      red_zone_tag: "Hearsay",
    });
    assert.equal(r.red_zone_dimension, "subtopic");
    assert.equal(r.red_zone_tag, "Hearsay");
  });
  it("rejects an unknown kind", () => {
    assert.throws(() => normalizeStartInput({ kind: "nope", slug: "x" }), DrillInputError);
  });
  it("clamps size into [1, 50] and rejects non-integers", () => {
    assert.equal(normalizeStartInput({ kind: "trap", slug: "x", size: 999 }).size, MAX_DRILL_SIZE);
    assert.equal(normalizeStartInput({ kind: "trap", slug: "x", size: 0 }).size, MIN_DRILL_SIZE);
    assert.throws(
      () => normalizeStartInput({ kind: "trap", slug: "x", size: 3.5 }),
      DrillInputError,
    );
  });
  it("rejects a non-object body", () => {
    assert.throws(() => normalizeStartInput(null), DrillInputError);
    assert.throws(() => normalizeStartInput("nope"), DrillInputError);
  });
});

describe("redZoneTargetFor / reasonFor / drillNameFor", () => {
  it("maps a tension drill onto the tension_point dimension", () => {
    const input = normalizeStartInput({ kind: "tension", slug: "effect_on_listener" });
    assert.deepEqual(redZoneTargetFor(input), {
      dimension: "tension_point",
      tag: "effect_on_listener",
    });
    assert.equal(reasonFor(input), "tension_drill");
    assert.equal(drillNameFor(input), "Effect On Listener tension drill");
  });
  it("maps a trap drill onto wrong_answer_architecture", () => {
    const input = normalizeStartInput({ kind: "trap", slug: "purpose_of_offer_confusion" });
    assert.deepEqual(redZoneTargetFor(input), {
      dimension: "wrong_answer_architecture",
      tag: "purpose_of_offer_confusion",
    });
    assert.equal(reasonFor(input), "trap_drill");
  });
  it("passes through the prescribed red-zone target", () => {
    const input = normalizeStartInput({
      kind: "prescribed_red_zone",
      red_zone_dimension: "subtopic",
      red_zone_tag: "Hearsay",
    });
    assert.deepEqual(redZoneTargetFor(input), { dimension: "subtopic", tag: "Hearsay" });
    assert.equal(reasonFor(input), "prescribed_red_zone_drill");
    assert.equal(drillNameFor(input), "Hearsay repair drill");
  });
});
