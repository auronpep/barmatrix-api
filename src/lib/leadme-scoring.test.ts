import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LeadMeSubmitResult } from "./leadme-submit.js";
import { applyLeadMeScoringProjection, projectLeadMeScoring } from "./leadme-scoring.js";
import type { DbPool, QueryResult } from "../db.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(calls: RecordedQuery[]): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  };
}

function submitResult(): LeadMeSubmitResult {
  const scoringSignals = {
    correct_demonstrates: [],
    incorrect_indicates: [
      { type: "red_zone", value: "wrong_actor", strength: "strong" },
      { type: "trap", value: "judge_jury_confusion", strength: "medium" },
    ],
    observed_modifiers: [
      { type: "confidence_calibration", value: "wrong_high_confidence", strength: "medium" },
    ],
  };
  return {
    served_snapshot_id: "snap_1",
    queue_entry_id: "lq_1",
    student_id: "stu_1",
    item_id: "LM-100",
    item_version: "1.0.0",
    selected_response: "B",
    correctness: "incorrect",
    branch_id: "BR-B",
    back_blocks: [],
    scoring_signals: scoringSignals,
    immediate_queue_proposal: null,
    next_action_summary: { type: "none", label: null },
    attempt_event: {
      served_snapshot_id: "snap_1",
      queue_entry_id: "lq_1",
      item_id: "LM-100",
      item_version: "1.0.0",
      selected_response: "B",
      correctness: "incorrect",
      branch_id: "BR-B",
      scoring_signals: scoringSignals,
    },
  };
}

describe("projectLeadMeScoring", () => {
  it("projects bounded mastery, red-zone, tag, and confidence updates from scoring evidence", () => {
    const projection = projectLeadMeScoring({
      result: submitResult(),
      studentId: "stu_1",
      attemptEventId: "att_1",
      subject: "EVIDENCE",
      primaryOutlineCode: "31010101",
      confidence: 80,
    });

    assert.equal(projection.outline_event.event_type, "leadme_submit");
    assert.equal(projection.outline_event.outline_code, "31010101");
    assert.equal(projection.outline_perf_delta.mastery_delta, -0.08);
    assert.equal(projection.outline_perf_delta.attempts_delta, 1);
    assert.equal(projection.outline_perf_delta.correct_delta, 0);
    assert.deepEqual(projection.red_zone_updates, [
      {
        red_zone_id: "EVIDENCE:31010101:red_zone:wrong_actor",
        tag_type: "red_zone",
        tag_value: "wrong_actor",
        severity: "high",
        score_delta: 0.125,
      },
    ]);
    assert.deepEqual(projection.tag_mastery_updates, [
      { tag_type: "red_zone", tag_value: "wrong_actor", attempts_delta: 1, correct_delta: 0 },
      { tag_type: "trap", tag_value: "judge_jury_confusion", attempts_delta: 1, correct_delta: 0 },
    ]);
    assert.deepEqual(projection.confidence_update, {
      calibration_key: "EVIDENCE:31010101:high",
      confidence_bucket: "high",
      attempts_delta: 1,
      correct_delta: 0,
      overconfidence_delta: 0.08,
      underconfidence_delta: 0,
    });
  });

  it("writes outline, red-zone, tag-mastery, and confidence fanout rows", async () => {
    const calls: RecordedQuery[] = [];
    const projection = projectLeadMeScoring({
      result: submitResult(),
      studentId: "stu_1",
      attemptEventId: "att_1",
      subject: "EVIDENCE",
      primaryOutlineCode: "31010101",
      confidence: 80,
    });

    await applyLeadMeScoringProjection(dbFor(calls), projection);

    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_outline_events")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_outline_perf")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_red_zones")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_tag_mastery")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_confidence_calibration")));
  });
});
