import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import { readLeadMeCurrent } from "./leadme-current-service.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(
  calls: RecordedQuery[],
  options: { queueContentHash?: string; itemContentHash?: string } = {},
): Queryable {
  const queueContentHash = options.queueContentHash ?? "sha256:content";
  const itemContentHash = options.itemContentHash ?? "sha256:content";
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("FROM student_leadme_queue")) {
        return {
          rows: [
            {
              queue_entry_id: "lq_1",
              student_id: "stu_1",
              item_id: "LM-100",
              item_version: "1.0.0",
              content_hash: queueContentHash,
              status: "available",
              rail_scope: "current_day",
              day_number: 1,
              origin_day_number: 1,
              priority: "10.0000",
              mandatory: 0,
              dependency_free: 1,
              available_at: "2026-06-18 00:00:00",
              served_at: null,
              viewed_at: null,
              started_at: null,
              completed_at: null,
              stalled_at: null,
              stall_eligible_at: null,
              injection_depth: 0,
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("FROM leadme_items")) {
        if (values[2] !== itemContentHash) {
          return { rows: [], rowCount: 0 } as QueryResult<T>;
        }
        return {
          rows: [
            {
              item_id: "LM-100",
              version: "1.0.0",
              item_type: "drill_question",
              subject: "EVIDENCE",
              primary_outline_code: "31010101",
              content_hash: itemContentHash,
              compiled_json_text: JSON.stringify({
                item_id: "LM-100",
                item_version: "1.0.0",
                title: "A safe item",
                prompt: "Call?",
                interaction: {
                  type: "multiple_choice",
                  options: [{ id: "A", label: "Right" }, { id: "B", label: "Wrong" }],
                },
              }),
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("FROM leadme_compiled_payloads")) {
        return {
          rows: [
            {
              submit_private_json: JSON.stringify({
                item_id: "LM-100",
                item_version: "1.0.0",
                content_hash: "sha256:content",
                correct: ["A"],
                responses: { A: { branch_id: "BR-A" }, B: { branch_id: "BR-B" } },
              }),
              branch_private_json: JSON.stringify({
                item_id: "LM-100",
                item_version: "1.0.0",
                content_hash: "sha256:content",
                branches: { "BR-A": { display_blocks: [], actions: [] }, "BR-B": { display_blocks: [], actions: [] } },
              }),
              compiled_server_payload_hash: "sha256:server",
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      return { rows: [], rowCount: 1 } as QueryResult<T>;
    },
  };
}

describe("readLeadMeCurrent", () => {
  it("serves the selected current-day item without leaking server-only payloads", async () => {
    const calls: RecordedQuery[] = [];

    const response = await readLeadMeCurrent(dbFor(calls), {
      studentId: "stu_1",
      currentDay: 1,
      now: new Date("2026-06-18T12:00:00Z"),
    });

    assert.equal(response.current_task?.queue_entry_id, "lq_1");
    assert.equal(response.current_task?.selection_reason, "current_day");
    assert.equal(response.current_task?.item.queue_entry_id, "lq_1");
    assert.equal(response.current_task?.item.item_id, "LM-100");
    assert.equal("content_hash" in (response.current_task?.item ?? {}), false);
    assert.equal("correct" in (response.current_task?.item ?? {}), false);
    assert.equal("responses" in (response.current_task?.item ?? {}), false);
    assert.equal("branches" in (response.current_task?.item ?? {}), false);
    assert.ok(
      calls.some((call) => call.sql.includes("INSERT IGNORE INTO leadme_served_snapshots")),
      "served snapshot insert was not called",
    );
    assert.ok(
      calls.some((call) => call.sql.includes("UPDATE student_leadme_queue")),
      "queue served update was not called",
    );
    assert.ok(
      calls.some((call) => call.sql.includes("FROM leadme_items") && call.values[2] === "sha256:content"),
      "item lookup did not include queued content hash",
    );
  });

  it("does not serve a queue entry whose content hash no longer matches the item", async () => {
    const calls: RecordedQuery[] = [];

    await assert.rejects(
      () =>
        readLeadMeCurrent(dbFor(calls, { queueContentHash: "sha256:stale" }), {
          studentId: "stu_1",
          currentDay: 1,
          now: new Date("2026-06-18T12:00:00Z"),
        }),
      /LeadMe item not found: LM-100@1\.0\.0/,
    );
  });
});
