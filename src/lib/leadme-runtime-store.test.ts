import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import { evaluateLeadMeSubmit, type ServedLeadMeSnapshot } from "./leadme-submit.js";
import {
  enqueueLeadMeSet,
  enqueueLeadMeSetForOutline,
  markLeadMeQueueCompleted,
  markLeadMeQueueViewed,
  readLeadMeSubmissionByIdempotency,
  readLeadMeSetSummary,
  recordLeadMeServedSnapshot,
  recordLeadMeSubmission,
} from "./leadme-runtime-store.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(
  handler: (query: RecordedQuery) => QueryResult<unknown>,
  calls: RecordedQuery[] = [],
): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      const query = { sql, values };
      calls.push(query);
      return handler(query) as QueryResult<T>;
    },
  };
}

function servedSnapshot(): ServedLeadMeSnapshot {
  return {
    schema_version: "served_snapshot.v1",
    snapshot: {
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
      server_evaluation_ref: "compiled://LM-100@1.0.0",
      immutable: true,
    },
    submit_private: {
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      correct: ["A"],
      responses: {
        A: { branch_id: "BR-A-CORRECT", scoring_signals: { correct_demonstrates: [] } },
        B: { branch_id: "BR-B", scoring_signals: { incorrect_indicates: [] } },
      },
    },
    branch_private: {
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      branches: {
        "BR-A-CORRECT": { display_blocks: [], actions: [{ type: "continue_set" }] },
        "BR-B": {
          display_blocks: [{ type: "wrong_answer_path", markdown: "Repair this trap." }],
          actions: [{ type: "enqueue_immediate", item_id: "LMS-B-REPAIR" }],
        },
      },
    },
  };
}

describe("leadme runtime store", () => {
  it("marks a served queue entry viewed and records the event", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor(() => ({ rows: [], rowCount: 1 }), calls);

    const updated = await markLeadMeQueueViewed(db, {
      eventId: "evt_view_1",
      studentId: "stu_1",
      queueEntryId: "lq_1",
      itemId: "LM-100",
      setId: "set_1",
      timeSpentSec: 3,
    });

    assert.equal(updated, true);
    assert.match(calls[0]?.sql ?? "", /UPDATE student_leadme_queue/);
    assert.match(calls[0]?.sql ?? "", /status = CASE WHEN status = 'served' THEN 'viewed'/);
    assert.match(calls[1]?.sql ?? "", /INSERT INTO student_leadme_events/);
    assert.deepEqual(calls[1]?.values, [
      "evt_view_1",
      "stu_1",
      "lq_1",
      "LM-100",
      "set_1",
      "view",
      3,
    ]);
  });

  it("marks a queue entry completed and records the event", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor(() => ({ rows: [], rowCount: 1 }), calls);

    const updated = await markLeadMeQueueCompleted(db, {
      eventId: "evt_complete_1",
      studentId: "stu_1",
      queueEntryId: "lq_1",
      itemId: "LM-100",
      setId: "set_1",
      timeSpentSec: 12,
    });

    assert.equal(updated, true);
    assert.match(calls[0]?.sql ?? "", /SET status = 'completed'/);
    assert.match(calls[1]?.sql ?? "", /INSERT INTO student_leadme_events/);
    assert.deepEqual(calls[1]?.values, [
      "evt_complete_1",
      "stu_1",
      "lq_1",
      "LM-100",
      "set_1",
      "complete",
      12,
    ]);
  });

  it("summarizes set progress from set entries and this student's queue", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor(() => ({
      rows: [
        {
          set_id: "set_1",
          title: "Evidence repair set",
          set_type: "repair",
          status: "active",
          total_items: "4",
          completed_items: "2",
          active_items: "1",
        },
      ],
      rowCount: 1,
    }), calls);

    const summary = await readLeadMeSetSummary(db, {
      studentId: "stu_1",
      setId: "set_1",
    });

    assert.deepEqual(summary, {
      set_id: "set_1",
      title: "Evidence repair set",
      set_type: "repair",
      status: "active",
      total_items: 4,
      completed_items: 2,
      active_items: 1,
      pending_items: 2,
    });
    assert.match(calls[0]?.sql ?? "", /FROM leadme_sets s/);
    assert.match(calls[0]?.sql ?? "", /LEFT JOIN leadme_set_entries e/);
    assert.match(calls[0]?.sql ?? "", /LEFT JOIN student_leadme_queue q/);
    assert.deepEqual(calls[0]?.values, ["set_1", "stu_1"]);
  });

  it("enqueues an active set's published items for a student once", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor((query) => {
      if (query.sql.includes("FROM leadme_sets s") && query.sql.includes("COUNT")) {
        return {
          rows: [
            {
              set_id: "set_1",
              title: "Evidence repair set",
              set_type: "repair",
              status: "active",
              total_items: "3",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 2 };
    }, calls);

    const result = await enqueueLeadMeSet(db, {
      studentId: "stu_1",
      setId: "set_1",
      currentDay: 4,
    });

    assert.deepEqual(result, {
      set_id: "set_1",
      title: "Evidence repair set",
      set_type: "repair",
      status: "active",
      total_items: 3,
      inserted_items: 2,
    });
    assert.match(calls[1]?.sql ?? "", /INSERT IGNORE INTO student_leadme_queue/);
    assert.match(calls[1]?.sql ?? "", /JOIN leadme_set_entries e/);
    assert.match(calls[1]?.sql ?? "", /JOIN leadme_items i/);
    assert.match(calls[1]?.sql ?? "", /SHA2\(CONCAT\(\$1/);
    assert.deepEqual(calls[1]?.values, ["stu_1", "set_1", 4]);
  });

  it("resolves an active set from an outline code before enqueueing it", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor((query) => {
      if (query.sql.includes("WHERE primary_outline_code = $1")) {
        return { rows: [{ set_id: "set_1" }], rowCount: 1 };
      }
      if (query.sql.includes("FROM leadme_sets s") && query.sql.includes("COUNT")) {
        return {
          rows: [
            {
              set_id: "set_1",
              title: "Evidence repair set",
              set_type: "guided_repair",
              status: "active",
              total_items: "2",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 2 };
    }, calls);

    const result = await enqueueLeadMeSetForOutline(db, {
      studentId: "stu_1",
      outlineCode: "31010100",
      currentDay: 6,
    });

    assert.equal(result?.set_id, "set_1");
    assert.equal(result?.inserted_items, 2);
    assert.match(calls[0]?.sql ?? "", /FROM leadme_sets/);
    assert.match(calls[0]?.sql ?? "", /primary_outline_code = \$1/);
    assert.match(calls[1]?.sql ?? "", /COUNT\(DISTINCT CASE WHEN i\.item_id IS NOT NULL/);
    assert.match(calls[2]?.sql ?? "", /INSERT IGNORE INTO student_leadme_queue/);
    assert.deepEqual(calls[0]?.values, ["31010100"]);
    assert.deepEqual(calls[2]?.values, ["stu_1", "set_1", 6]);
  });

  it("records a served snapshot with immutable compiler hashes", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor(() => ({ rows: [], rowCount: 1 }), calls);

    const inserted = await recordLeadMeServedSnapshot(db, servedSnapshot());

    assert.equal(inserted, true);
    assert.match(calls[0]?.sql ?? "", /INSERT IGNORE INTO leadme_served_snapshots/);
    assert.match(calls[0]?.sql ?? "", /compiled_server_payload_hash/);
    assert.deepEqual(calls[0]?.values, [
      "snap_1",
      "lq_1",
      "stu_1",
      "LM-100",
      "1.0.0",
      "sha256:content",
      "sha256:front",
      "sha256:server",
      "sha256:answers",
      "compiled://LM-100@1.0.0",
      "2026-06-18 12:00:00",
      null,
    ]);
  });

  it("stores the full submit result payload for idempotent replay", async () => {
    const snapshot = servedSnapshot();
    const result = evaluateLeadMeSubmit(snapshot, {
      queue_entry_id: "lq_1",
      selected_response: "B",
      idempotency_key: "idem_1",
    });
    const calls: RecordedQuery[] = [];
    const db = dbFor(() => ({ rows: [], rowCount: 1 }), calls);

    const saved = await recordLeadMeSubmission(db, {
      submissionId: "sub_1",
      studentId: "stu_1",
      idempotencyKey: "idem_1",
      attemptEventId: "attempt_1",
      result,
    });

    assert.equal(saved.inserted, true);
    assert.deepEqual(saved.result, result);
    assert.match(calls[0]?.sql ?? "", /INSERT IGNORE INTO leadme_submissions/);
    assert.match(calls[0]?.sql ?? "", /response_payload_json/);
    assert.match(calls[0]?.sql ?? "", /response_payload_hash/);
    assert.equal(calls[0]?.values[0], "sub_1");
    assert.equal(calls[0]?.values[10], "idem_1");
    assert.equal(calls[0]?.values[11], JSON.stringify(result));
    assert.match(String(calls[0]?.values[12]), /^sha256:[0-9a-f]{64}$/);
  });

  it("returns the stored result when a duplicate idempotency insert is ignored", async () => {
    const snapshot = servedSnapshot();
    const first = evaluateLeadMeSubmit(snapshot, {
      queue_entry_id: "lq_1",
      selected_response: "B",
      idempotency_key: "idem_1",
    });
    const calls: RecordedQuery[] = [];
    const db = dbFor((query) => {
      if (query.sql.includes("INSERT IGNORE INTO leadme_submissions")) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [
          {
            student_id: "stu_1",
            queue_entry_id: "lq_1",
            idempotency_key: "idem_1",
            attempt_event_id: "att_1",
            response_payload_json: JSON.stringify(first),
          },
        ],
        rowCount: 1,
      };
    }, calls);

    const saved = await recordLeadMeSubmission(db, {
      submissionId: "sub_2",
      studentId: "stu_1",
      idempotencyKey: "idem_1",
      attemptEventId: null,
      result: evaluateLeadMeSubmit(snapshot, {
        queue_entry_id: "lq_1",
        selected_response: "A",
        idempotency_key: "idem_1",
      }),
    });

    assert.equal(saved.inserted, false);
    assert.deepEqual(saved.result, first);
    assert.equal(calls.length, 2);
    assert.match(calls[1]?.sql ?? "", /SELECT student_id, queue_entry_id, idempotency_key, attempt_event_id, response_payload_json/);
  });

  it("parses an existing idempotent submission row", async () => {
    const result = evaluateLeadMeSubmit(servedSnapshot(), {
      queue_entry_id: "lq_1",
      selected_response: "B",
      idempotency_key: "idem_1",
    });
    const db = dbFor(() => ({
      rows: [
        {
          student_id: "stu_1",
          queue_entry_id: "lq_1",
          idempotency_key: "idem_1",
          attempt_event_id: "att_1",
          response_payload_json: JSON.stringify(result),
        },
      ],
      rowCount: 1,
    }));

    const existing = await readLeadMeSubmissionByIdempotency(db, {
      studentId: "stu_1",
      queueEntryId: "lq_1",
      idempotencyKey: "idem_1",
    });

    assert.deepEqual(existing, {
      student_id: "stu_1",
      queue_entry_id: "lq_1",
      idempotency_key: "idem_1",
      attempt_event_id: "att_1",
      result,
    });
  });

  it("throws a contextual error when an idempotent replay payload is corrupt", async () => {
    const db = dbFor(() => ({
      rows: [
        {
          student_id: "stu_1",
          queue_entry_id: "lq_1",
          idempotency_key: "idem_1",
          attempt_event_id: "att_1",
          response_payload_json: "{not json",
        },
      ],
      rowCount: 1,
    }));

    await assert.rejects(
      () => readLeadMeSubmissionByIdempotency(db, {
        studentId: "stu_1",
        queueEntryId: "lq_1",
        idempotencyKey: "idem_1",
      }),
      /invalid response_payload_json/,
    );
  });
});
