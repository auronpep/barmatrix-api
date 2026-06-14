import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import { DIAGNOSTIC_LENGTH, computeDiagnosticResults } from "./diagnostic.js";
import {
  AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS,
  DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR,
  buildAmbassadorDiagnosticMysqlMigration,
  buildFixedDiagnosticQuestionSelection,
  loadAmbassadorDiagnosticSources,
  shapeDiagnosticRecommendation,
  toDiagnosticAttemptRow,
} from "./ambassador-diagnostic.js";

// This is a live-file integration suite: it reads 20 markdown source files
// from the diagnostic source directory. Set AMBASSADOR_DIAGNOSTIC_SOURCE_DIR
// to the path where the source files are stored, or the suite will be skipped.
const sourceDir = DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR;
const sourcesAvailable = existsSync(sourceDir);

describe(
  "ambassador diagnostic integration",
  { skip: !sourcesAvailable ? `source dir not found: ${sourceDir}` : false },
  () => {
  it("uses the 20 fixed DIAG external ids in serving order", () => {
    assert.equal(DIAGNOSTIC_LENGTH, 20);
    assert.equal(AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS.length, 20);
    assert.deepEqual(AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS.slice(0, 3), [
      "DIAG-001",
      "DIAG-002",
      "DIAG-003",
    ]);
    assert.equal(AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS.at(-1), "DIAG-020");
  });

  it("parses all 20 source files into graded questions with one mold tag per distractor", () => {
    assert.ok(
      existsSync(DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR),
      `missing source dir ${DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR}`,
    );

    const questions = loadAmbassadorDiagnosticSources();
    assert.equal(questions.length, 20);

    for (const [index, question] of questions.entries()) {
      assert.equal(question.external_id, AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS[index]);
      assert.match(question.source_file, /^Q1111\d+\.md$/);
      assert.equal(question.status, "diagnostic");
      assert.ok(question.subject.length > 0, `${question.source_file} subject`);
      assert.ok(question.subtopic.length > 0, `${question.source_file} subtopic`);
      assert.ok(question.fact_pattern.length > 40, `${question.source_file} fact pattern`);
      assert.ok(question.call_of_question.length > 8, `${question.source_file} call`);
      assert.ok(["A", "B", "C", "D"].includes(question.correct_answer));
      assert.equal(question.choices.length, 4);

      for (const choice of question.choices) {
        if (choice.letter === question.correct_answer) {
          assert.equal(choice.is_correct, true, `${question.source_file} credited ${choice.letter}`);
          assert.deepEqual(choice.forensic_tags, []);
        } else {
          assert.equal(choice.is_correct, false, `${question.source_file} distractor ${choice.letter}`);
          assert.equal(choice.forensic_tags.length, 1, `${question.source_file} ${choice.letter}`);
          assert.equal(choice.forensic_tags[0], choice.mold_code);
        }
      }
    }

    const q1 = questions[0]!;
    assert.equal(q1.source_file, "Q111111.md");
    assert.equal(q1.subject, "CIVIL_PROCEDURE");
    assert.equal(q1.correct_answer, "A");
    assert.equal(q1.choices.find((choice) => choice.letter === "B")?.mold_code, "fabricated_rule");
    assert.equal(q1.choices.find((choice) => choice.letter === "C")?.mold_code, "bait_doctrine");
    assert.equal(q1.anchor_card?.id, "CIV-ANCHOR-ERIE-15C");
  });

  it("builds fixed diagnostic selection SQL for status diagnostic rows only", () => {
    const selection = buildFixedDiagnosticQuestionSelection();
    assert.match(selection.sql, /q\.status = 'diagnostic'/);
    assert.match(selection.sql, /FIELD\(q\.external_id,/);
    assert.doesNotMatch(selection.sql, /q\.status = 'active'/);
    assert.deepEqual(selection.values.slice(0, 20), AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS);
    assert.deepEqual(selection.values.slice(20), AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS);
  });

  it("returns a personal recommendation from diagnostic score and top trap", () => {
    const questions = loadAmbassadorDiagnosticSources();
    const attempts = [
      toDiagnosticAttemptRow(questions[0]!, "C", 5),
      toDiagnosticAttemptRow(questions[1]!, "C", 4),
      ...questions.slice(2).map((question) =>
        toDiagnosticAttemptRow(question, question.correct_answer, 3),
      ),
    ];
    const results = computeDiagnosticResults(attempts);
    const recommendation = shapeDiagnosticRecommendation(results);

    assert.equal(results.answered, 20);
    assert.equal(results.summary.correct, 18);
    assert.equal(recommendation.level.level, 4);
    assert.equal(recommendation.top_leak?.tag, "bait_doctrine");
    assert.equal(recommendation.next_step.primary_label, "Start The Method");
    assert.equal(recommendation.next_step.href, "/foundations/lesson-01");
  });

  it("generates idempotent MariaDB SQL without JSON casts", () => {
    const questions = loadAmbassadorDiagnosticSources();
    const sql = buildAmbassadorDiagnosticMysqlMigration(questions);

    assert.match(sql, /INSERT INTO questions/);
    assert.match(sql, /INSERT INTO answer_choices/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE/);
    assert.doesNotMatch(sql, /CAST\s*\(/i);
    assert.match(sql, /'DIAG-001'/);
    assert.match(sql, /'\["fabricated_rule"\]'/);
    assert.match(sql, /'\[\]'/);
    assert.match(
      sql,
      /\(SELECT question_id FROM questions WHERE external_id = 'DIAG-001'\)/,
    );
    assert.equal((sql.match(/-- choice DIAG-/g) ?? []).length, 80);
  });
});
