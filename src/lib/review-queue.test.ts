import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReviewReason,
  isReviewStatus,
  isTerminalStatus,
  enqueueReview,
  type ReviewDb,
} from "./review-queue.js";

describe("review-queue validators", () => {
  it("recognizes valid reasons and statuses", () => {
    assert.equal(isReviewReason("NEEDS_HUMAN"), true);
    assert.equal(isReviewReason("HIGH_FLAG_RATE"), true);
    assert.equal(isReviewReason("nope"), false);
    assert.equal(isReviewStatus("queued"), true);
    assert.equal(isReviewStatus("done"), false);
  });

  it("identifies terminal statuses", () => {
    assert.equal(isTerminalStatus("resolved"), true);
    assert.equal(isTerminalStatus("retired"), true);
    assert.equal(isTerminalStatus("blocked"), true);
    assert.equal(isTerminalStatus("queued"), false);
    assert.equal(isTerminalStatus("assigned"), false);
  });
});

// A tiny in-memory ReviewDb double records queries so we can assert idempotency
// behavior without a real database.
function fakeDb(openRows: Array<{ review_id: string }>): {
  db: ReviewDb;
  inserts: number;
} {
  let inserts = 0;
  const db: ReviewDb = {
    async query<T>(sql: string) {
      if (sql.includes("SELECT review_id FROM review_queue")) {
        return { rows: openRows as unknown as T[] };
      }
      if (sql.startsWith("INSERT INTO review_queue")) {
        inserts++;
        return { rows: [] as T[], rowCount: 1 };
      }
      return { rows: [] as T[] };
    },
  };
  return { db, get inserts() { return inserts; } } as { db: ReviewDb; inserts: number };
}

describe("enqueueReview idempotency", () => {
  it("inserts when no open row exists", async () => {
    const h = fakeDb([]);
    const r = await enqueueReview(h.db, { question_id: "q1", reason: "NEEDS_HUMAN" });
    assert.equal(r.queued, true);
    assert.ok(r.review_id);
    assert.equal(h.inserts, 1);
  });

  it("skips when an open row already exists", async () => {
    const h = fakeDb([{ review_id: "existing-1" }]);
    const r = await enqueueReview(h.db, { question_id: "q1", reason: "NEEDS_HUMAN" });
    assert.equal(r.queued, false);
    assert.equal(r.review_id, "existing-1");
    assert.equal(h.inserts, 0);
  });
});
