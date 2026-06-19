import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import { submitLeadMeItem } from "./leadme-submit-service.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function servedSnapshotRow() {
  return {
    served_snapshot_id: "snap_1",
    queue_entry_id: "lq_1",
    student_id: "stu_1",
    item_id: "LM-100",
    item_version: "1.0.0",
    content_hash: "sha256:content",
    compiled_front_payload_hash: "sha256:front",
    compiled_server_payload_hash: "sha256:server",
    answer_order_hash: "sha256:answers",
    served_at: "2026-06-18T12:00:00Z",
    expires_at: null,
    server_evaluation_ref: "leadme_compiled_payloads:LM-100:1.0.0:sha256:content",
    submit_private_json: JSON.stringify({
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      correct: ["A"],
      responses: {
        A: { branch_id: "BR-A", scoring_signals: { correct_demonstrates: [] } },
        B: { branch_id: "BR-B", scoring_signals: { incorrect_indicates: [] } },
      },
    }),
    branch_private_json: JSON.stringify({
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      branches: {
        "BR-A": { display_blocks: [], actions: [{ type: "continue_set" }] },
        "BR-B": {
          display_blocks: [{ type: "wrong_answer_path", markdown: "Repair this trap." }],
          actions: [
            {
              type: "enqueue_immediate",
              item_id: "LMS-B-REPAIR",
              item_version: "1.0.0",
              label: "Repair card added",
              mandatory: true,
              dependency_free: true,
            },
          ],
        },
      },
    }),
    item_type: "drill_question",
    subject: "EVIDENCE",
    primary_outline_code: "31010101",
    external_id: "q_1",
    set_id: "set_1",
    day_number: 2,
    origin_day_number: 2,
    injection_depth: 0,
  };
}

function dbFor(calls: RecordedQuery[]): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("FROM leadme_submissions")) {
        return { rows: [], rowCount: 0 } as QueryResult<T>;
      }
      if (sql.includes("FROM leadme_served_snapshots")) {
        return { rows: [servedSnapshotRow()], rowCount: 1 } as QueryResult<T>;
      }
      return { rows: [], rowCount: 1 } as QueryResult<T>;
    },
  };
}

describe("submitLeadMeItem", () => {
  it("evaluates the served snapshot, persists the submission, writes attempt rows, and completes the queue entry", async () => {
    const calls: RecordedQuery[] = [];

    const response = await submitLeadMeItem(dbFor(calls), {
      studentId: "stu_1",
      queueEntryId: "lq_1",
      selectedResponse: "B",
      idempotencyKey: "idem_1",
      confidence: 70,
      timeSpentSec: 42,
      now: new Date("2026-06-18T12:05:00Z"),
      eventIdFactory: () => "att_1",
      submissionIdFactory: () => "sub_1",
      repairQueueEntryIdFactory: () => "repair_1",
    });

    assert.equal(response.idempotent_replay, false);
    assert.equal(response.attempt_event_id, "att_1");
    assert.equal(response.result.correctness, "incorrect");
    assert.equal(response.result.branch_id, "BR-B");
    assert.ok(calls.some((call) => call.sql.includes("INSERT IGNORE INTO leadme_submissions")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT INTO student_attempts")));
    assert.ok(calls.some((call) => call.sql.includes("INSERT IGNORE INTO attempt_telemetry_ext")));
    assert.ok(
      calls.some(
        (call) =>
          call.sql.includes("INSERT IGNORE INTO student_leadme_queue") &&
          call.sql.includes("content_hash") &&
          call.sql.includes("i.content_hash") &&
          call.sql.includes("FROM leadme_items i") &&
          call.sql.includes("i.status IN ('active', 'published')") &&
          call.values[0] === "repair_1" &&
          call.values[5] === "LMS-B-REPAIR",
      ),
    );
    assert.ok(calls.some((call) => call.sql.includes("UPDATE student_leadme_queue")));
  });
});
