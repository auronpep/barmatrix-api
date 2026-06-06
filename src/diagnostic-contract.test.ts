import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shapeDiagnosticRecommendation } from "./lib/ambassador-diagnostic.js";
import {
  extractDiagnosticAnchors,
  type AnchorSourceRow,
  type DiagnosticResults,
  type TopTrapPattern,
} from "./lib/diagnostic.js";

function topTrapPattern(overrides: Partial<TopTrapPattern> = {}): TopTrapPattern {
  return {
    rank: 1,
    dimension: "wrong_answer_architecture",
    tag: "fabricated_rule",
    label: "Fabricated Rule",
    subject: "Evidence",
    proficiency_score: 0,
    attempts: 1,
    high_confidence_wrongs: 1,
    severity: "high",
    ...overrides,
  };
}

function diagnosticResults(
  overrides: Partial<DiagnosticResults> = {},
): DiagnosticResults {
  return {
    answered: 1,
    summary: {
      correct: 0,
      total: 1,
      score_pct: 0,
      avg_confidence: 5,
      avg_time_seconds: 30,
      high_confidence_misses: 1,
    },
    red_zones: { by_dimension: {} },
    top_trap_patterns: [],
    ...overrides,
  };
}

describe("launch diagnostic results contract", () => {
  it("shapes the recommendation fields used by the launch results view", () => {
    const topLeak = topTrapPattern();
    const recommendation = shapeDiagnosticRecommendation(
      diagnosticResults({ top_trap_patterns: [topLeak] }),
    );

    assert.deepEqual(Object.keys(recommendation).sort(), [
      "level",
      "next_step",
      "top_leak",
    ]);
    assert.equal(typeof recommendation.level.label, "string");
    assert.equal(typeof recommendation.level.description, "string");
    assert.deepEqual(Object.keys(recommendation.next_step).sort(), [
      "copy",
      "href",
      "primary_label",
    ]);
    assert.equal(typeof recommendation.next_step.primary_label, "string");
    assert.equal(typeof recommendation.next_step.href, "string");
    assert.equal(typeof recommendation.next_step.copy, "string");
    assert.equal(typeof recommendation.top_leak, "object");
    assert.deepEqual(recommendation.top_leak, topLeak);

    const noLeak = shapeDiagnosticRecommendation(
      diagnosticResults({ top_trap_patterns: [] }),
    );
    assert.equal(noLeak.top_leak, null);
  });

  it("extracts anchor cards with the public anchor element fields", () => {
    const rows: AnchorSourceRow[] = [
      {
        metadata: JSON.stringify({
          anchor_card: {
            id: "EVID-ANCHOR-HEARSAY",
            title: "Hearsay purpose",
            front: "Ask why the statement is offered.",
            back: "If offered for legal effect, it is not hearsay.",
          },
        }),
        external_id: "DIAG-001",
        subject: "Evidence",
      },
      {
        metadata: JSON.stringify({
          anchor_card: {
            id: "EVID-ANCHOR-HEARSAY",
            title: "Duplicate",
            front: "Duplicate prompt",
            back: "Duplicate rule",
          },
        }),
        external_id: "DIAG-002",
        subject: "Evidence",
      },
      {
        metadata: JSON.stringify({
          anchor_card: {
            id: "CIVPRO-ANCHOR-FRONT",
            title: null,
            front: "Front-only rule survives when back is blank.",
            back: " ",
          },
        }),
        external_id: null,
        subject: null,
      },
      {
        metadata: "{not-json",
        external_id: "DIAG-003",
        subject: "Contracts",
      },
    ];

    const anchors = extractDiagnosticAnchors(rows);

    assert.ok(Array.isArray(anchors));
    assert.equal(anchors.length, 2);

    for (const anchor of anchors) {
      assert.deepEqual(Object.keys(anchor).sort(), [
        "id",
        "prompt",
        "rule",
        "source_tag",
        "subject",
        "title",
      ]);
      assert.equal(typeof anchor.id, "string");
      assert.equal(typeof anchor.rule, "string");
      assert.equal(typeof anchor.source_tag, "string");
      assert.equal(typeof anchor.subject, "string");
      assert.ok(
        typeof anchor.title === "string" || anchor.title === null,
        "anchor.title is string | null",
      );
      assert.ok(
        typeof anchor.prompt === "string" || anchor.prompt === null,
        "anchor.prompt is string | null",
      );
    }

    assert.deepEqual(anchors[0], {
      id: "EVID-ANCHOR-HEARSAY",
      title: "Hearsay purpose",
      rule: "If offered for legal effect, it is not hearsay.",
      prompt: "Ask why the statement is offered.",
      source_tag: "DIAG-001",
      subject: "Evidence",
    });
    assert.deepEqual(anchors[1], {
      id: "CIVPRO-ANCHOR-FRONT",
      title: null,
      rule: "Front-only rule survives when back is blank.",
      prompt: "Front-only rule survives when back is blank.",
      source_tag: "",
      subject: "",
    });
  });
});
