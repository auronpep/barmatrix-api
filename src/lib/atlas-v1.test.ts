import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import {
  AtlasV1ValidationError,
  readAtlasV1Coverage,
  readAtlasV1StudentCoverage,
  readAtlasV1StudentQuestions,
  readAtlasV1Questions,
  setAtlasV1QuestionStatus,
  shapeAtlasV1Answer,
  shapeAtlasV1Detours,
  submitAtlasV1Question,
} from "./atlas-v1.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(calls: RecordedQuery[] = []): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("FROM atlas_component_gates")) {
        return { rows: [{ status: "approved" }], rowCount: 1 } as QueryResult<T>;
      }
      if (sql.includes("FROM atlas_outline_nodes") && sql.includes("WHERE code = $1")) {
        return {
          rows: [
            {
              code: "31010103",
              subject: "EVIDENCE",
              subject_display: "Evidence",
              subtopic: "Presentation of Evidence",
              outline_text: "Presumptions and Inferences",
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("SELECT q.question_id") && sql.includes("FROM atlas_questions q")) {
        return {
          rows: [
            {
              question_id: "CQ31010103A",
              outline_code: "31010103",
              status: "review",
              stem: "Stem",
              call_text: "Call",
              correct_answer: "A",
              source_label: "FOC Finished",
              source_ref: "C:\\FOC\\Workspace\\Finished\\CQ31010103A.md",
              included_at: null,
              updated_at: "2026-06-19T10:00:00Z",
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("FROM atlas_outline_nodes")) {
        return {
          rows: [
            {
              code: "31010103",
              parent_code: "31010100",
              subject: "EVIDENCE",
              subject_display: "Evidence",
              subtopic: "Presentation of Evidence",
              outline_text: "Presumptions and Inferences",
              display_label: "31010103 - Presumptions and Inferences",
              level: "3",
              leaf: "1",
              included_count: "0",
              review_count: "1",
              last_included_at: null,
            },
            {
              code: "31010104",
              parent_code: "31010100",
              subject: "EVIDENCE",
              subject_display: "Evidence",
              subtopic: "Presentation of Evidence",
              outline_text: "Materiality and probative value",
              display_label: "31010104 - Materiality and probative value",
              level: "3",
              leaf: "1",
              included_count: "2",
              review_count: "1",
              last_included_at: "2026-06-19T10:00:00Z",
            },
          ],
          rowCount: 2,
        } as QueryResult<T>;
      }
      return { rows: [], rowCount: 1 } as QueryResult<T>;
    },
  };
}

describe("Atlas_v1 coverage", () => {
  it("reads outline-code-first coverage from independent Atlas_v1 tables", async () => {
    const calls: RecordedQuery[] = [];
    const coverage = await readAtlasV1Coverage(dbFor(calls), {
      subject: "EVIDENCE",
      questionStatus: "review",
      limit: 25,
    });

    assert.deepEqual(coverage.nodes.map((node) => [node.code, node.coverage_state]), [
      ["31010103", "in_review"],
      ["31010104", "covered"],
    ]);
    assert.equal(coverage.summary.in_review, 1);
    assert.equal(coverage.summary.covered, 1);
    assert.equal(coverage.summary.missing, 0);
    assert.match(calls[0]?.sql ?? "", /FROM atlas_outline_nodes n/);
    assert.match(calls[0]?.sql ?? "", /LEFT JOIN atlas_questions q/);
    assert.doesNotMatch(calls[0]?.sql ?? "", /FROM outline_nodes/);
    assert.doesNotMatch(calls[0]?.sql ?? "", /student_outline_perf/);
  });
});

describe("Atlas_v1 question intake", () => {
  it("lists questions for one outline code and status", async () => {
    const calls: RecordedQuery[] = [];
    const questions = await readAtlasV1Questions(dbFor(calls), {
      outline_code: "31010103",
      status: "review",
      limit: 20,
    });

    assert.equal(questions.items[0]?.question_id, "CQ31010103A");
    assert.match(calls[0]?.sql ?? "", /FROM atlas_questions q/);
    assert.match(calls[0]?.sql ?? "", /q\.outline_code = \$1/);
    assert.match(calls[0]?.sql ?? "", /q\.status = \$2/);
  });

  it("submits one question only when the questions lane is approved", async () => {
    const calls: RecordedQuery[] = [];
    const result = await submitAtlasV1Question(dbFor(calls), {
      question_id: "CQ31010103A",
      outline_code: "31010103",
      status: "included",
      stem: "A witness testifies that a fact is usually true.",
      call_text: "Is the jury permitted to infer the fact?",
      answer_a: "Yes, if the basic fact is established.",
      answer_b: "Yes, but only if the judge directs the finding.",
      answer_c: "No, because presumptions never affect civil proof.",
      answer_d: "No, because inferences are excluded from evidence.",
      correct_answer: "A",
      minimum_explanation: "A permissive inference may allow, but not require, the factfinder to infer the fact.",
      source_label: "FOC Finished",
      source_ref: "C:\\FOC\\Workspace\\Finished\\CQ31010103A.md",
      included_by: "founder",
    });

    assert.equal(result.question_id, "CQ31010103A");
    assert.equal(result.status, "included");
    assert.match(calls[0]?.sql ?? "", /atlas_component_gates/);
    assert.match(calls[1]?.sql ?? "", /atlas_outline_nodes/);
    assert.match(calls[2]?.sql ?? "", /INSERT INTO atlas_questions/);
  });

  it("rejects included questions with missing required base fields", async () => {
    await assert.rejects(
      () =>
        submitAtlasV1Question(dbFor(), {
          question_id: "bad",
          outline_code: "31010103",
          status: "included",
          stem: "",
          call_text: "Call",
          answer_a: "A",
          answer_b: "B",
          answer_c: "C",
          answer_d: "D",
          correct_answer: "A",
          minimum_explanation: "Explanation",
        }),
      (err) =>
        err instanceof AtlasV1ValidationError &&
        err.errors.includes("stem is required"),
    );
  });

  it("moves a whole question into included status", async () => {
    const calls: RecordedQuery[] = [];
    const result = await setAtlasV1QuestionStatus(dbFor(calls), {
      question_id: "CQ31010103A",
      status: "included",
      included_by: "founder",
    });

    assert.deepEqual(result, {
      question_id: "CQ31010103A",
      status: "included",
      updated: true,
    });
    assert.match(calls[0]?.sql ?? "", /UPDATE atlas_questions/);
    assert.match(calls[0]?.sql ?? "", /included_at/);
  });
});

describe("Atlas_v1 student views", () => {
  it("exposes only included outline counts and question fields to students", async () => {
    const coverage = await readAtlasV1StudentCoverage(dbFor());
    const questions = await readAtlasV1StudentQuestions(dbFor(), {
      outline_code: "31010103",
      limit: 20,
    });

    assert.deepEqual(coverage.nodes.map((node) => [node.code, node.question_count]), [
      ["31010104", 2],
    ]);
    assert.deepEqual(Object.keys(questions.items[0] ?? {}).sort(), [
      "call_text",
      "outline_code",
      "question_id",
      "stem",
    ]);
  });
});

describe("Atlas_v1 answer case study", () => {
  it("omits missing optional modules while preserving the base answer page", () => {
    const answer = shapeAtlasV1Answer({
      question_id: "CQ1",
      outline_code: "31010103",
      outline_text: "Presumptions and Inferences",
      subject_display: "Evidence",
      subtopic: "Presentation of Evidence",
      stem: "Stem",
      call_text: "Call",
      answer_a: "A",
      answer_b: "B",
      answer_c: "C",
      answer_d: "D",
      correct_answer: "A",
      minimum_explanation: "Explanation",
      case_study_json: JSON.stringify({
        facts: [{ fact: "Basic fact", role: "trigger" }],
        repair: {},
      }),
    });

    assert.equal(answer.question.question_id, "CQ1");
    assert.deepEqual(Object.keys(answer.case_study_modules), ["facts"]);
  });
});

describe("Atlas_v1 detours", () => {
  it("computes student-visible detours from included target counts", () => {
    const detours = shapeAtlasV1Detours(
      [
        {
          type: "outline_code",
          key: "31010103",
          label: "More Presumptions and Inferences",
          target_count: 99,
          visibility: "student",
        },
        {
          type: "trap",
          key: "judge-directs-finding",
          label: "Same trap",
          target_count: 99,
          visibility: "student",
        },
        {
          type: "red_zone",
          key: "missing-basic-fact",
          label: "Missing basic fact",
          target_count: 99,
          visibility: "admin_only",
        },
      ],
      new Map([
        ["outline_code:31010103", 2],
        ["trap:judge-directs-finding", 0],
        ["red_zone:missing-basic-fact", 3],
      ]),
      "student",
    );

    assert.deepEqual(detours, [
      {
        type: "outline_code",
        key: "31010103",
        label: "More Presumptions and Inferences",
        target_count: 2,
        visibility: "student",
      },
    ]);
  });
});
