import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import type { LeadMeSubmitResult } from "./leadme-submit.js";
import {
  buildLeadMeAttemptEvent,
  buildLeadMeAttemptTelemetryRow,
  buildLeadMeStudentAttemptRow,
  insertLeadMeAttemptTelemetry,
  insertLeadMeStudentAttempt,
} from "./leadme-attempt-adapter.js";

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
    incorrect_indicates: [{ type: "c3_incorrect", value: "NOT_TRUE" }],
    observed_modifiers: [],
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
    back_blocks: [{ type: "wrong_answer_path", markdown: "Repair this trap." }],
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

const adapterInput = {
  eventId: "att_1",
  studentId: "stu_1",
  occurredAt: "2026-06-18T12:05:00Z",
  result: submitResult(),
  itemType: "drill_question",
  sourceQuestionId: "q_1",
  selectedChoiceId: null,
  correctResponse: "A",
  primaryOutlineCode: "75080102",
  subject: "CRIMINAL",
  setId: "set_1",
  programId: "july-2026",
  timeSpentSec: 42,
  activeTimeSec: 37,
  firstChoiceAtSec: 8,
  confidenceInitial: 55,
  confidenceFinal: 70,
  flagged: false,
  skipped: false,
} as const;

describe("leadme attempt adapter", () => {
  it("builds a student_attempt_event.v2 payload from a LeadMe submission", () => {
    const event = buildLeadMeAttemptEvent(adapterInput);

    assert.deepEqual(event, {
      schema_version: "student_attempt_event.v2",
      event: {
        event_id: "att_1",
        student_id: "stu_1",
        occurred_at: "2026-06-18T12:05:00Z",
      },
      context: {
        source_surface: "leadme",
        program_id: "july-2026",
        set_id: "set_1",
        queue_entry_id: "lq_1",
        item_id: "LM-100",
        qid: "q_1",
      },
      interaction: {
        type: "drill_question",
        selected_response: "B",
        correct_response: "A",
        correctness: "incorrect",
        time_spent_sec: 42,
        confidence: 70,
      },
      atlas: {
        primary_outline_code: "75080102",
        subject: "CRIMINAL",
        secondary_outline_codes: [],
      },
      scoring_signals: submitResult().scoring_signals,
      forensics: {
        branch_id: "BR-B",
        served_snapshot_id: "snap_1",
      },
    });
  });

  it("maps wrapped drill questions into legacy student_attempt rows", () => {
    const row = buildLeadMeStudentAttemptRow(adapterInput);

    assert.deepEqual(row, {
      attempt_id: "att_1",
      student_id: "stu_1",
      question_id: "q_1",
      selected_choice_id: null,
      selected_letter: "B",
      correct: 0,
      confidence: 4,
      flagged: 0,
      time_seconds: 42,
      platform: "leadme",
      set_id: "set_1",
      served_snapshot_id: "snap_1",
      metadata: {
        schema_version: "student_attempt_event.v2",
        source_surface: "leadme",
        queue_entry_id: "lq_1",
        item_id: "LM-100",
        item_version: "1.0.0",
        branch_id: "BR-B",
        selected_response: "B",
        scoring_signals: submitResult().scoring_signals,
      },
    });
  });

  it("does not create legacy attempt rows for non-drill LeadMe items", () => {
    const row = buildLeadMeStudentAttemptRow({
      ...adapterInput,
      itemType: "wrong_answer_navigation",
      sourceQuestionId: null,
    });

    assert.equal(row, null);
  });

  it("writes compatible student_attempts and telemetry extension rows", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor(calls);
    const attemptRow = buildLeadMeStudentAttemptRow(adapterInput);
    assert.ok(attemptRow);
    const telemetryRow = buildLeadMeAttemptTelemetryRow(adapterInput);

    await insertLeadMeStudentAttempt(db, attemptRow);
    await insertLeadMeAttemptTelemetry(db, telemetryRow);

    assert.match(calls[0]?.sql ?? "", /INSERT INTO student_attempts/);
    assert.match(calls[0]?.sql ?? "", /served_snapshot_id/);
    assert.equal(calls[0]?.values[0], "att_1");
    assert.equal(calls[0]?.values[2], "q_1");
    assert.equal(calls[0]?.values[4], "B");
    assert.equal(calls[0]?.values[5], 0);
    assert.equal(calls[0]?.values[6], 4);
    assert.equal(calls[0]?.values[11], "snap_1");
    assert.match(String(calls[0]?.values[12]), /"queue_entry_id":"lq_1"/);

    assert.match(calls[1]?.sql ?? "", /INSERT IGNORE INTO attempt_telemetry_ext/);
    assert.deepEqual(calls[1]?.values, [
      "att_1",
      "stu_1",
      "leadme",
      "lq_1",
      "LM-100",
      "set_1",
      42,
      37,
      8,
      0,
      55,
      70,
      1,
      "high",
      0,
      0,
    ]);
  });
});
