import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shapeMyTrapProfile,
  shapeMyTrapHistory,
  deriveProfileMetrics,
  type MyTrapProfileRow,
  type MyTrapOccurrenceRow,
  type MyTrapAggregateRow,
} from "./me-traps.js";

describe("shapeMyTrapProfile", () => {
  it("drops correct_answer, source_* and non-discriminating slugs, stamps name+official", () => {
    const rows: MyTrapProfileRow[] = [
      { slug: "wrong_standard", kind: "forensic", fell_count: 8, confident_fell_count: 3, last_fell_at: "2026-05-29T18:22:10Z" },
      { slug: "correct_answer", kind: "forensic", fell_count: 5, confident_fell_count: 1, last_fell_at: "2026-05-29T10:00:00Z" },
      { slug: "source_combined_explanation", kind: "forensic", fell_count: 9, confident_fell_count: 4, last_fell_at: "2026-05-29T11:00:00Z" },
      { slug: "physical-injury-required", kind: "misconception", fell_count: 2, confident_fell_count: 0, last_fell_at: "2026-05-28T09:00:00Z" },
    ];
    const out = shapeMyTrapProfile(rows);
    assert.deepEqual(out.map((t) => t.slug), ["wrong_standard", "physical-injury-required"]);
    assert.equal(out[0].name, "Wrong Standard");
    assert.equal(out[0].official, true);
    assert.equal(out[0].fell_count, 8);
    assert.equal(out[0].confident_fell_count, 3);
    assert.equal(out[1].official, false);
    assert.equal(out[1].kind, "misconception");
  });

  it("orders by fell_count desc then slug asc", () => {
    const rows: MyTrapProfileRow[] = [
      { slug: "b_trap", kind: "forensic", fell_count: 2, confident_fell_count: 0, last_fell_at: null },
      { slug: "a_trap", kind: "forensic", fell_count: 2, confident_fell_count: 0, last_fell_at: null },
      { slug: "c_trap", kind: "forensic", fell_count: 5, confident_fell_count: 0, last_fell_at: null },
    ];
    assert.deepEqual(shapeMyTrapProfile(rows).map((t) => t.slug), ["c_trap", "a_trap", "b_trap"]);
  });
});

describe("deriveProfileMetrics", () => {
  it("sums falls and picks the top trap", () => {
    const traps = shapeMyTrapProfile([
      { slug: "wrong_standard", kind: "forensic", fell_count: 8, confident_fell_count: 3, last_fell_at: null },
      { slug: "wrong_remedy", kind: "forensic", fell_count: 4, confident_fell_count: 1, last_fell_at: null },
    ]);
    assert.deepEqual(deriveProfileMetrics(traps), {
      distinct_traps: 2,
      total_falls: 12,
      total_confident_falls: 4,
      top_trap_slug: "wrong_standard",
    });
  });

  it("is zero-safe for an empty profile", () => {
    assert.deepEqual(deriveProfileMetrics([]), {
      distinct_traps: 0,
      total_falls: 0,
      total_confident_falls: 0,
      top_trap_slug: null,
    });
  });
});

describe("shapeMyTrapHistory", () => {
  it("builds totals + recent occurrences with name/official", () => {
    const agg: MyTrapAggregateRow = { fell_count: 3, confident_fell_count: 1, first_fell_at: "2026-05-20T00:00:00Z", last_fell_at: "2026-05-29T00:00:00Z" };
    const recent: MyTrapOccurrenceRow[] = [
      { attempt_id: "a1", question_id: "q1", external_id: "EV-001", subject: "Evidence", subtopic: "Hearsay", selected_letter: "B", confidence: 5, attempted_at: "2026-05-29T00:00:00Z", why_attractive: "looks right", why_wrong_or_correct: "but isn't", future_cue: "watch for X" },
    ];
    const out = shapeMyTrapHistory("wrong_standard", agg, recent);
    assert.equal(out.slug, "wrong_standard");
    assert.equal(out.name, "Wrong Standard");
    assert.equal(out.official, true);
    assert.equal(out.fell_count, 3);
    assert.equal(out.confident_fell_count, 1);
    assert.equal(out.recent[0].external_id, "EV-001");
    assert.equal(out.recent[0].selected_letter, "B");
    assert.equal(out.recent[0].confidence, 5);
    assert.equal(out.recent[0].why_wrong, "but isn't");
  });

  it("returns a zero history when the student never fell for the slug", () => {
    const out = shapeMyTrapHistory("wrong_standard", { fell_count: 0, confident_fell_count: 0, first_fell_at: null, last_fell_at: null }, []);
    assert.equal(out.fell_count, 0);
    assert.deepEqual(out.recent, []);
  });
});
