import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
  buildKnowledgeSearchQuery,
  normalizeKnowledgeSearch,
  shapeKnowledgeSearchResponse,
} = await import("./knowledge.js");

describe("knowledge retrieval helpers", () => {
  it("normalizes component aliases and clamps the result limit", () => {
    const filters = normalizeKnowledgeSearch({
      component: "trap-taxonomy",
      q: "decoder",
      limit: "500",
    });

    assert.equal(filters.component, "02-trap-taxonomy");
    assert.equal(filters.q, "decoder");
    assert.equal(filters.limit, 50);
  });

  it("builds a gated component-aware full-text query", () => {
    const filters = normalizeKnowledgeSearch({
      component: "04-drill-library",
      channel: "channel2",
      q: "decoder",
      review_status: "needs_review",
      limit: 12,
    });

    const query = buildKnowledgeSearchQuery(filters);

    assert.match(query.sql, /MATCH\(ko\.summary, ko\.body\) AGAINST/);
    assert.match(query.sql, /CAST\(\$\d+ AS CHAR CHARACTER SET utf8mb4\) COLLATE utf8mb4_unicode_ci/);
    assert.match(query.sql, /JSON_CONTAINS\(ko\.component_targets, JSON_QUOTE\(\$\d+\)\)/);
    assert.match(query.sql, /ko\.promotion_status NOT IN \('rejected', 'archived'\)/);
    assert.deepEqual(query.values, [
      "decoder",
      "04-drill-library",
      "channel2",
      "needs_review",
      12,
    ]);
  });

  it("shapes rows with provenance, review gates, and component groupings", () => {
    const response = shapeKnowledgeSearchResponse(
      normalizeKnowledgeSearch({ component: "trap-taxonomy" }),
      [
        {
          object_id: "KO-SRC-0650-C2A-001",
          object_type: "wrong_answer_architecture",
          source_id: "SRC-0650",
          source_role: "idea_input",
          source_path: "content-center/10-sources/master-packets/BARMATRIX_CHANNEL2_PROGRAM_MASTER_(1).md",
          source_span_start: null,
          source_span_end: null,
          canonicality: "candidate",
          review_status: "needs_review",
          promotion_status: "hold",
          subject: null,
          topic: null,
          subtopic: null,
          taxonomy_version: null,
          taxonomy_ids: "{}",
          channel: "channel2",
          component_targets: "[\"02-trap-taxonomy\",\"04-drill-library\"]",
          wrong_answer_tags: "[\"wrong_party\"]",
          channel2_architecture: "RIGHT_RULE_WRONG_PARTY",
          surface_pattern: null,
          decoder_move: null,
          summary: "A correct rule is applied to the wrong party.",
          body: "A correct rule is applied to the wrong party in the answer choice.",
          metadata: "{\"surface_patterns\":[\"party shift\"]}",
          text_score: 1.5,
        },
      ],
    );

    assert.equal(response.results.length, 1);
    assert.deepEqual(response.by_component["02-trap-taxonomy"], ["KO-SRC-0650-C2A-001"]);
    assert.equal(response.results[0]?.source.source_id, "SRC-0650");
    assert.equal(response.results[0]?.review.review_status, "needs_review");
    assert.deepEqual(response.results[0]?.wrong_answer_tags, ["wrong_party"]);
  });
});
