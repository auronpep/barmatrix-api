import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import { recordAttemptFeedback } from "./attempt-feedback.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(
  calls: RecordedQuery[],
  owned: boolean,
): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("owned_attempts")) {
        return {
          rows: owned ? [{ attempt_event_id: "att_1" }] : [],
          rowCount: owned ? 1 : 0,
        } as QueryResult<T>;
      }
      return { rows: [], rowCount: 1 } as QueryResult<T>;
    },
  };
}

describe("recordAttemptFeedback", () => {
  it("refuses feedback for an attempt not owned by the student", async () => {
    const calls: RecordedQuery[] = [];

    const result = await recordAttemptFeedback(dbFor(calls, false), {
      feedbackId: "fb_1",
      studentId: "stu_1",
      attemptEventId: "att_1",
      eliminatedChoices: ["A"],
    });

    assert.equal(result, null);
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.sql ?? "", /FROM leadme_submissions/);
    assert.match(calls[0]?.sql ?? "", /FROM attempt_telemetry_ext/);
    assert.match(calls[0]?.sql ?? "", /FROM student_attempts/);
  });

  it("records student-owned feedback into attempt_feedback", async () => {
    const calls: RecordedQuery[] = [];

    const result = await recordAttemptFeedback(dbFor(calls, true), {
      feedbackId: "fb_1",
      studentId: "stu_1",
      attemptEventId: "att_1",
      eliminatedChoices: ["A", "D"],
      strugglePair: ["B", "C"],
      whySelected: "recognized_rule",
      skipped: false,
    });

    assert.deepEqual(result, { feedback_id: "fb_1" });
    assert.match(calls[1]?.sql ?? "", /INSERT INTO attempt_feedback/);
    assert.deepEqual(calls[1]?.values, [
      "fb_1",
      "att_1",
      "stu_1",
      JSON.stringify(["A", "D"]),
      JSON.stringify(["B", "C"]),
      "recognized_rule",
      0,
    ]);
  });
});
