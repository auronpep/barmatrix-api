import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import { readOutlineAtlas, readOutlineAtlasNode } from "./outline-atlas.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(calls: RecordedQuery[] = []): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      calls.push({ sql, values });
      if (sql.includes("FROM outline_node_attachments")) {
        return {
          rows: [
            {
              attachment_type: "leadme_item",
              attachment_id: "LM-1",
              role: "application",
              status: "active",
              sort_order: 10,
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("LEFT JOIN outline_node_edges")) {
        return {
          rows: [
            {
              code: "31010101",
              ab: "31",
              level: 3,
              parent_code: "31010100",
              label: "Authentication",
              path: "Evidence > Relevance > Authentication",
              status: "weak",
              mastery_score: "0.3000",
              confidence: "0.4000",
              attempts: "2",
              correct: "1",
              accuracy: "0.5000",
              q_available: "4",
              last_attempt_at: "2026-06-18T12:00:00Z",
              last_seen_at: "2026-06-18T12:00:00Z",
              dominant_trap: "wrong_foundation",
              dominant_red_zone_id: "rz_1",
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      if (sql.includes("LEFT JOIN student_outline_perf")) {
        return {
          rows: [
            {
              code: "31010100",
              ab: "31",
              level: 2,
              parent_code: "31010000",
              label: "Evidence relevance",
              path: "Evidence > Relevance",
              status: "shaky",
              mastery_score: "0.5500",
              confidence: "0.6000",
              attempts: "3",
              correct: "2",
              accuracy: "0.6667",
              q_available: "9",
              last_attempt_at: "2026-06-18T12:00:00Z",
              last_seen_at: "2026-06-18T12:00:00Z",
              dominant_trap: "wrong_scope",
              dominant_red_zone_id: "rz_1",
            },
          ],
          rowCount: 1,
        } as QueryResult<T>;
      }
      return {
        rows: [
          {
            code: "31010100",
            ab: "31",
            level: 2,
            parent_code: "31010000",
            label: "Evidence relevance",
            path: "Evidence > Relevance",
          },
        ],
        rowCount: 1,
      } as QueryResult<T>;
    },
  };
}

describe("outline atlas", () => {
  it("reads the public outline atlas from outline_nodes", async () => {
    const calls: RecordedQuery[] = [];

    const atlas = await readOutlineAtlas(dbFor(calls), { limit: 25 });

    assert.deepEqual(atlas.nodes, [
      {
        code: "31010100",
        ab: "31",
        level: 2,
        parent_code: "31010000",
        label: "Evidence relevance",
        path: "Evidence > Relevance",
      },
    ]);
    assert.match(calls[0]?.sql ?? "", /FROM outline_nodes/);
    assert.deepEqual(calls[0]?.values, [25]);
  });

  it("reads a node detail with active attachments and children", async () => {
    const node = await readOutlineAtlasNode(dbFor(), { code: "31010100" });

    assert.equal(node?.node.code, "31010100");
    assert.deepEqual(node?.node.attachments, [
      {
        attachment_type: "leadme_item",
        attachment_id: "LM-1",
        role: "application",
        status: "active",
        sort_order: 10,
      },
    ]);
    assert.equal(node?.node.children?.[0]?.code, "31010101");
  });

  it("adds private student outline performance when a student id is supplied", async () => {
    const atlas = await readOutlineAtlas(dbFor(), {
      studentId: "stu_1",
      limit: 25,
    });

    assert.deepEqual(atlas.nodes[0]?.student_overlay, {
      status: "shaky",
      mastery_score: 0.55,
      confidence: 0.6,
      attempts: 3,
      correct: 2,
      accuracy: 0.6667,
      q_available: 9,
      last_attempt_at: "2026-06-18T12:00:00Z",
      last_seen_at: "2026-06-18T12:00:00Z",
      dominant_trap: "wrong_scope",
      dominant_red_zone_id: "rz_1",
    });
  });
});
