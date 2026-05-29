import assert from "node:assert/strict";
import { describe, it } from "node:test";

// lib/traps.ts is dependency-free (no config/db import), so it loads without the
// boot-time env vars that config.ts requires. Imported statically for clarity.
import {
  buildTrapExamplesQuery,
  buildTrapListQuery,
  buildTrapQuestionsCountQuery,
  buildTrapQuestionsQuery,
  buildTrapSubjectDistributionQuery,
  clampTrapPage,
  clampTrapQuestionsLimit,
  humanizeTrapSlug,
  isOfficialTrap,
  normalizeTrapSlug,
  resolveIncludeHidden,
  shapeTrapDetail,
  shapeTrapList,
  shapeTrapQuestions,
  TrapInputError,
  type TrapExampleRow,
  type TrapListRow,
} from "./traps.js";

describe("trap slug validation", () => {
  it("accepts real bank slugs including underscores, hyphens, and codes", () => {
    assert.equal(normalizeTrapSlug("purpose_of_offer_confusion"), "purpose_of_offer_confusion");
    assert.equal(normalizeTrapSlug("physical-injury-required"), "physical-injury-required");
    assert.equal(normalizeTrapSlug("M-TORT-IT-001"), "M-TORT-IT-001");
    assert.equal(normalizeTrapSlug("  wrong_party  "), "wrong_party");
  });

  it("rejects empty, spaced, and injection-shaped slugs", () => {
    for (const bad of ["", "   ", "a b", "drop table", 'a"b', "a'b", "tag,tag", "[1]", "тег"]) {
      assert.throws(() => normalizeTrapSlug(bad), TrapInputError, `expected reject: ${bad}`);
    }
  });

  it("rejects slugs longer than 128 chars", () => {
    assert.throws(() => normalizeTrapSlug("a".repeat(129)), TrapInputError);
    assert.equal(normalizeTrapSlug("a".repeat(128)), "a".repeat(128));
  });
});

describe("official trap classification", () => {
  it("marks locked taxonomy slugs official and bank-only slugs unofficial", () => {
    assert.equal(isOfficialTrap("purpose_of_offer_confusion"), true);
    assert.equal(isOfficialTrap("wrong_party"), true);
    assert.equal(isOfficialTrap("exception_hunting"), true);
    // Observed in the Hearsay seam but not on the canonical list.
    assert.equal(isOfficialTrap("hearsay_reflex"), false);
    assert.equal(isOfficialTrap("wrong_exception"), false);
  });

  it("never treats correct_answer as an official trap", () => {
    // correct_answer is in the canonical array but only ever tags the correct
    // choice, which trap queries filter out (is_correct = 0).
    assert.equal(isOfficialTrap("correct_answer"), false);
  });
});

describe("slug humanization", () => {
  it("title-cases underscore and hyphen separated slugs", () => {
    assert.equal(humanizeTrapSlug("purpose_of_offer_confusion"), "Purpose Of Offer Confusion");
    assert.equal(humanizeTrapSlug("physical-injury-required"), "Physical Injury Required");
    assert.equal(humanizeTrapSlug("wrong_party"), "Wrong Party");
  });
});

describe("include_hidden gating", () => {
  it("never includes hidden rows in production", () => {
    assert.equal(resolveIncludeHidden("true", "production"), false);
    assert.equal(resolveIncludeHidden("1", "production"), false);
  });

  it("honors truthy values outside production and defaults to false", () => {
    assert.equal(resolveIncludeHidden("true", "development"), true);
    assert.equal(resolveIncludeHidden("1", "development"), true);
    assert.equal(resolveIncludeHidden("yes", "development"), true);
    assert.equal(resolveIncludeHidden("false", "development"), false);
    assert.equal(resolveIncludeHidden(undefined, "development"), false);
    assert.equal(resolveIncludeHidden(["true"], "development"), true);
  });
});

describe("pagination clamps", () => {
  it("clamps limit into [1, 100] with a default of 25", () => {
    assert.equal(clampTrapQuestionsLimit(undefined), 25);
    assert.equal(clampTrapQuestionsLimit("0"), 1);
    assert.equal(clampTrapQuestionsLimit("500"), 100);
    assert.equal(clampTrapQuestionsLimit("40"), 40);
  });

  it("clamps page to a minimum of 1", () => {
    assert.equal(clampTrapPage(undefined), 1);
    assert.equal(clampTrapPage("0"), 1);
    assert.equal(clampTrapPage("-3"), 1);
    assert.equal(clampTrapPage("7"), 7);
  });
});

describe("list query", () => {
  it("unnests both tag columns, excludes correct_answer, and filters active by default", () => {
    const query = buildTrapListQuery(false);
    assert.match(query.sql, /JSON_TABLE\(\s*ac\.forensic_tags, '\$\[\*\]'/);
    assert.match(query.sql, /JSON_TABLE\(\s*ac\.misconception_tags, '\$\[\*\]'/);
    assert.match(query.sql, /ac\.is_correct = 0/);
    assert.match(query.sql, /q\.status = 'active'/);
    assert.match(query.sql, /t\.slug <> 'correct_answer'/);
    assert.doesNotMatch(query.sql, /status IN \('active', 'hidden'\)/);
    assert.deepEqual(query.values, []);
  });

  it("widens the status filter when hidden rows are included", () => {
    const query = buildTrapListQuery(true);
    assert.match(query.sql, /q\.status IN \('active', 'hidden'\)/);
    assert.doesNotMatch(query.sql, /q\.status = 'active'/);
  });
});

describe("detail + questions queries", () => {
  it("binds the slug through JSON_QUOTE for the examples query", () => {
    const query = buildTrapExamplesQuery("wrong_party", false);
    assert.match(query.sql, /JSON_CONTAINS\(ac\.forensic_tags, JSON_QUOTE\(\$1\)\)/);
    assert.match(query.sql, /JSON_CONTAINS\(ac\.misconception_tags, JSON_QUOTE\(\$1\)\)/);
    assert.match(query.sql, /ac\.is_correct = 0/);
    assert.match(query.sql, /LIMIT \$2/);
    assert.deepEqual(query.values, ["wrong_party", 20]);
  });

  it("groups subject distribution by subject", () => {
    const query = buildTrapSubjectDistributionQuery("exception_hunting", false);
    assert.match(query.sql, /GROUP BY q\.subject/);
    assert.match(query.sql, /JSON_CONTAINS\(ac\.forensic_tags, JSON_QUOTE\(\$1\)\)/);
    assert.deepEqual(query.values, ["exception_hunting"]);
  });

  it("uses an EXISTS subquery with offset pagination for the questions list", () => {
    const query = buildTrapQuestionsQuery("wrong_party", false, 25, 50);
    assert.match(query.sql, /EXISTS \(/);
    assert.match(query.sql, /LIMIT \$2 OFFSET \$3/);
    assert.deepEqual(query.values, ["wrong_party", 25, 50]);

    const count = buildTrapQuestionsCountQuery("wrong_party", false);
    assert.match(count.sql, /COUNT\(\*\) AS total/);
    assert.deepEqual(count.values, ["wrong_party"]);
  });
});

describe("list shaping", () => {
  it("splits forensic vs misconception rows, marks official, and drops correct_answer", () => {
    const rows: TrapListRow[] = [
      { slug: "purpose_of_offer_confusion", kind: "forensic", question_count: "5", choice_count: "7" },
      { slug: "hearsay_reflex", kind: "misconception", question_count: 3, choice_count: 4 },
      { slug: "wrong_party", kind: "forensic", question_count: 2, choice_count: 2 },
      { slug: "wrong_party", kind: "misconception", question_count: 1, choice_count: 1 },
      { slug: "correct_answer", kind: "forensic", question_count: 9, choice_count: 9 },
    ];

    const shaped = shapeTrapList(rows);

    assert.equal(shaped.architecture.length, 2);
    assert.equal(shaped.misconception.length, 2);
    assert.equal(shaped.architecture[0]?.slug, "purpose_of_offer_confusion");
    assert.equal(shaped.architecture[0]?.official, true);
    assert.equal(shaped.architecture[0]?.name, "Purpose Of Offer Confusion");
    assert.equal(shaped.architecture[0]?.question_count, 5);
    const hearsay = shaped.misconception.find((t) => t.slug === "hearsay_reflex");
    assert.equal(hearsay?.official, false);
    // correct_answer must never surface as a trap.
    assert.equal(
      [...shaped.architecture, ...shaped.misconception].some((t) => t.slug === "correct_answer"),
      false,
    );
    // wrong_party appears in both columns but is counted once toward official_count.
    assert.equal(shaped.totals.official_count, 2);
    assert.equal(shaped.totals.architecture_count, 2);
    assert.equal(shaped.totals.misconception_count, 2);
  });
});

describe("detail shaping", () => {
  it("maps choice fields, derives kinds from membership flags, and sums distribution", () => {
    const exampleRows: TrapExampleRow[] = [
      {
        question_id: "11111111-1111-1111-1111-111111111111",
        external_id: "HS-001",
        subject: "Evidence",
        topic: "Hearsay",
        subtopic: "Hearsay - truth of matter",
        letter: "A",
        choice_text: "Sustain the objection...",
        why_attractive: "Looks like hearsay",
        why_wrong_or_correct: "Offered for effect on listener",
        future_cue: "Ask the purpose first",
        in_forensic: 1,
        in_misconception: "0",
      },
    ];
    const subjectRows = [
      { subject: "Evidence", question_count: "4" },
      { subject: "Torts", question_count: 2 },
    ];

    const detail = shapeTrapDetail("purpose_of_offer_confusion", exampleRows, subjectRows);

    assert.equal(detail.slug, "purpose_of_offer_confusion");
    assert.equal(detail.name, "Purpose Of Offer Confusion");
    assert.equal(detail.official, true);
    assert.deepEqual(detail.kinds, ["forensic"]);
    assert.equal(detail.examples[0]?.why_wrong, "Offered for effect on listener");
    assert.equal(detail.examples[0]?.why_attractive, "Looks like hearsay");
    assert.deepEqual(detail.examples[0]?.kinds, ["forensic"]);
    assert.equal(detail.question_count, 6); // 4 + 2
    assert.equal(detail.subject_distribution[0]?.subject, "Evidence");
    assert.equal(detail.subject_distribution[0]?.question_count, 4);
    assert.equal(detail.examples_truncated, false);
  });

  it("flags truncation when the example count reaches the limit", () => {
    const rows: TrapExampleRow[] = Array.from({ length: 2 }, (_unused, i) => ({
      question_id: `q-${i}`,
      external_id: `EX-${i}`,
      subject: "Evidence",
      topic: null,
      subtopic: null,
      letter: "B",
      choice_text: "choice",
      why_attractive: null,
      why_wrong_or_correct: null,
      future_cue: null,
      in_forensic: "0",
      in_misconception: 1,
    }));

    const detail = shapeTrapDetail("exception_hunting", rows, [{ subject: "Evidence", question_count: 2 }], 2);
    assert.equal(detail.examples_truncated, true);
    assert.deepEqual(detail.kinds, ["misconception"]);
  });
});

describe("questions shaping", () => {
  it("passes paging through and maps question rows", () => {
    const shaped = shapeTrapQuestions("wrong_party", 2, 25, 40, [
      {
        question_id: "q1",
        external_id: "T-001",
        subject: "Torts",
        topic: "Battery",
        subtopic: "Intent",
        tension_point: "intent_to_contact_vs_harm",
      },
    ]);

    assert.equal(shaped.slug, "wrong_party");
    assert.equal(shaped.page, 2);
    assert.equal(shaped.limit, 25);
    assert.equal(shaped.total, 40);
    assert.equal(shaped.questions.length, 1);
    assert.equal(shaped.questions[0]?.external_id, "T-001");
  });
});
