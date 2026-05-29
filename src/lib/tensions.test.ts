// Pure-logic tests for the Tension Map helpers (no DB). Mirrors the node:test
// style of lib/traps.test.ts / routes/questions.test.ts. Run: npm test.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampTensionPage,
  clampTensionQuestionsLimit,
  humanizeTensionSlug,
  isMissingTableError,
  normalizeTensionSlug,
  resolveIncludeHidden,
  shapeTensionDetail,
  shapeTensionList,
  shapeTensionQuestions,
  tensionLinkKeys,
  TensionInputError,
  type TensionCatalogRow,
  type TensionObservedRow,
} from "./tensions.js";

const catalogRow: TensionCatalogRow = {
  tension_point_id: "CP-TM-001",
  slug: "cp_diversity_amount_vs_supplemental_jurisdiction",
  subject_code: "CP",
  subject: "Civil Procedure",
  domain: "Jurisdiction and venue",
  tension_name: "Diversity amount versus supplemental jurisdiction",
  legal_collision: "Complete diversity collides with supplemental jurisdiction.",
  decision_axis: "Confirm original jurisdiction first.",
  common_misconceptions: "Students aggregate unrelated claims.",
};

describe("humanizeTensionSlug", () => {
  it("title-cases snake and kebab tags", () => {
    assert.equal(humanizeTensionSlug("effect_on_listener"), "Effect On Listener");
    assert.equal(humanizeTensionSlug("CON-CM-018"), "CON CM 018");
  });
  it("returns the original when nothing to humanize", () => {
    assert.equal(humanizeTensionSlug(""), "");
  });
});

describe("normalizeTensionSlug", () => {
  it("accepts catalog slugs, ids, and bank codes", () => {
    assert.equal(normalizeTensionSlug("cp_diversity"), "cp_diversity");
    assert.equal(normalizeTensionSlug("CON-CM-018"), "CON-CM-018");
    assert.equal(normalizeTensionSlug(" effect_on_listener "), "effect_on_listener");
    assert.equal(normalizeTensionSlug(["CP-TM-001"]), "CP-TM-001");
  });
  it("rejects empty and unsafe values", () => {
    assert.throws(() => normalizeTensionSlug(""), TensionInputError);
    assert.throws(() => normalizeTensionSlug("a b"), TensionInputError);
    assert.throws(() => normalizeTensionSlug("x';DROP"), TensionInputError);
    assert.throws(() => normalizeTensionSlug(42), TensionInputError);
  });
});

describe("resolveIncludeHidden", () => {
  it("never includes hidden in production", () => {
    assert.equal(resolveIncludeHidden("true", "production"), false);
    assert.equal(resolveIncludeHidden("1", "production"), false);
  });
  it("honors truthy flags outside production", () => {
    assert.equal(resolveIncludeHidden("true", "development"), true);
    assert.equal(resolveIncludeHidden("1", undefined), true);
    assert.equal(resolveIncludeHidden("no", "development"), false);
    assert.equal(resolveIncludeHidden(undefined, "development"), false);
  });
});

describe("clamps", () => {
  it("clamps the questions limit into [1, 100]", () => {
    assert.equal(clampTensionQuestionsLimit(undefined), 25);
    assert.equal(clampTensionQuestionsLimit("9999"), 100);
    assert.equal(clampTensionQuestionsLimit("0"), 1);
    assert.equal(clampTensionQuestionsLimit("10"), 10);
  });
  it("clamps the page to >= 1", () => {
    assert.equal(clampTensionPage(undefined), 1);
    assert.equal(clampTensionPage("-3"), 1);
    assert.equal(clampTensionPage("4"), 4);
  });
});

describe("tensionLinkKeys", () => {
  it("includes the slug and the canonical id when distinct", () => {
    assert.deepEqual(tensionLinkKeys("cp_div", "CP-TM-001"), ["cp_div", "CP-TM-001"]);
  });
  it("dedupes when slug equals id and drops a null id", () => {
    assert.deepEqual(tensionLinkKeys("CP-TM-001", "CP-TM-001"), ["CP-TM-001"]);
    assert.deepEqual(tensionLinkKeys("effect_on_listener", null), ["effect_on_listener"]);
  });
});

describe("isMissingTableError", () => {
  it("recognizes the MySQL missing-table signals", () => {
    assert.equal(isMissingTableError({ code: "ER_NO_SUCH_TABLE" }), true);
    assert.equal(isMissingTableError({ errno: 1146 }), true);
  });
  it("ignores unrelated errors", () => {
    assert.equal(isMissingTableError({ code: "ER_PARSE_ERROR" }), false);
    assert.equal(isMissingTableError(new Error("boom")), false);
    assert.equal(isMissingTableError(null), false);
  });
});

describe("shapeTensionList", () => {
  const observed: TensionObservedRow[] = [
    { tension_value: "CP-TM-001", question_count: 5, subject: "Civil Procedure" },
    { tension_value: "effect_on_listener", question_count: 3, subject: "Evidence" },
  ];

  it("merges curated catalog with observed bank tags", () => {
    const out = shapeTensionList([catalogRow], observed);
    assert.equal(out.catalog_ready, true);
    assert.equal(out.totals.tension_count, 2);
    assert.equal(out.totals.official_count, 1);
    assert.equal(out.totals.observed_count, 1);

    const curated = out.tensions.find((t) => t.tension_point_id === "CP-TM-001");
    assert.ok(curated);
    assert.equal(curated.official, true);
    assert.equal(curated.name, "Diversity amount versus supplemental jurisdiction");
    assert.equal(curated.question_count, 5); // matched by id
    assert.equal(curated.slug, catalogRow.slug);

    const observedOnly = out.tensions.find((t) => t.slug === "effect_on_listener");
    assert.ok(observedOnly);
    assert.equal(observedOnly.official, false);
    assert.equal(observedOnly.question_count, 3);
    assert.equal(observedOnly.subject, "Evidence");
  });

  it("degrades to observed-only when the catalog table is absent", () => {
    const out = shapeTensionList(null, observed);
    assert.equal(out.catalog_ready, false);
    assert.equal(out.totals.official_count, 0);
    assert.equal(out.totals.observed_count, 2);
    assert.ok(out.tensions.every((t) => !t.official));
    assert.deepEqual(
      out.subjects,
      ["Civil Procedure", "Evidence"],
    );
  });

  it("keeps a curated tension with zero coverage", () => {
    const out = shapeTensionList([catalogRow], []);
    assert.equal(out.tensions.length, 1);
    assert.equal(out.tensions[0]?.question_count, 0);
    assert.equal(out.tensions[0]?.official, true);
  });
});

describe("shapeTensionDetail", () => {
  const subjectRows = [
    { subject: "Civil Procedure", question_count: 4 },
    { subject: "Evidence", question_count: 2 },
  ];
  const exampleRows = [
    {
      question_id: "q1",
      external_id: "CP-001",
      subject: "Civil Procedure",
      topic: "Jurisdiction",
      subtopic: null,
      question_stem: "  A   plaintiff sues...  ",
    },
  ];

  it("uses curated copy and sums coverage from subject distribution", () => {
    const out = shapeTensionDetail("cp_div", catalogRow, true, exampleRows, subjectRows);
    assert.equal(out.official, true);
    assert.equal(out.name, catalogRow.tension_name);
    assert.equal(out.tension_point_id, "CP-TM-001");
    assert.equal(out.legal_collision, catalogRow.legal_collision);
    assert.equal(out.question_count, 6);
    assert.equal(out.subject, "Civil Procedure");
    assert.equal(out.examples[0]?.stem_preview, "A plaintiff sues...");
    assert.equal(out.catalog_ready, true);
  });

  it("falls back to a humanized name when not curated", () => {
    const out = shapeTensionDetail("effect_on_listener", null, true, [], []);
    assert.equal(out.official, false);
    assert.equal(out.name, "Effect On Listener");
    assert.equal(out.tension_point_id, null);
    assert.equal(out.question_count, 0);
    assert.equal(out.legal_collision, null);
  });

  it("flags truncation when examples hit the limit", () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      question_id: `q${i}`,
      external_id: null,
      subject: "Evidence",
      topic: null,
      subtopic: null,
      question_stem: "stem",
    }));
    const out = shapeTensionDetail("x", null, true, rows, [], 3);
    assert.equal(out.examples_truncated, true);
  });
});

describe("shapeTensionQuestions", () => {
  it("passes through paged question rows", () => {
    const out = shapeTensionQuestions("cp_div", 2, 25, 51, [
      {
        question_id: "q1",
        external_id: "CP-001",
        subject: "Civil Procedure",
        topic: null,
        subtopic: null,
        tension_point: "CP-TM-001",
      },
    ]);
    assert.equal(out.page, 2);
    assert.equal(out.total, 51);
    assert.equal(out.questions.length, 1);
    assert.equal(out.questions[0]?.external_id, "CP-001");
  });
});
