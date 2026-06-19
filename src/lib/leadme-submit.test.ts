import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateLeadMeSubmit,
  resolveLeadMeSubmit,
  type LeadMeSubmissionRecord,
  type ServedLeadMeSnapshot,
} from "./leadme-submit.js";

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
      server_evaluation_ref: null,
      immutable: true,
    },
    submit_private: {
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      correct: ["A"],
      responses: {
        A: {
          branch_id: "BR-A-CORRECT",
          student_label: "TRUE_AND_RESPONSIVE",
          scoring_signals: {
            correct_demonstrates: [{ type: "c3_correct", value: "TRUE_AND_RESPONSIVE" }],
            incorrect_indicates: [],
            observed_modifiers: [],
          },
        },
        B: {
          branch_id: "BR-B",
          student_label: "NOT_TRUE",
          scoring_signals: {
            correct_demonstrates: [],
            incorrect_indicates: [
              { type: "c3_incorrect", value: "NOT_TRUE" },
              { type: "wal_tag", value: "WAL-HS-031" },
            ],
            observed_modifiers: [],
          },
        },
      },
    },
    branch_private: {
      item_id: "LM-100",
      item_version: "1.0.0",
      content_hash: "sha256:content",
      branches: {
        "BR-A-CORRECT": {
          display_blocks: [{ type: "correct_answer_path", markdown: "Correct path." }],
          actions: [{ type: "continue_set" }],
        },
        "BR-B": {
          display_blocks: [{ type: "wrong_answer_path", markdown: "Repair this trap." }],
          actions: [
            {
              type: "enqueue_immediate",
              item_id: "LMS-B-REPAIR-1",
              item_version: "1.0.0",
              label: "Repair card added",
              mandatory: true,
              dependency_free: true,
            },
            {
              type: "enqueue_immediate",
              item_id: "LMS-B-REPAIR-2",
              label: "Second repair should wait",
              mandatory: true,
              dependency_free: true,
            },
          ],
        },
      },
    },
  };
}

describe("evaluateLeadMeSubmit", () => {
  it("evaluates against the served snapshot and limits immediate repair enqueue proposals", () => {
    const result = evaluateLeadMeSubmit(servedSnapshot(), {
      queue_entry_id: "lq_1",
      selected_response: "B",
      idempotency_key: "idem_1",
    });

    assert.equal(result.served_snapshot_id, "snap_1");
    assert.equal(result.item_id, "LM-100");
    assert.equal(result.item_version, "1.0.0");
    assert.equal(result.correctness, "incorrect");
    assert.equal(result.branch_id, "BR-B");
    assert.deepEqual(result.back_blocks, [
      { type: "wrong_answer_path", markdown: "Repair this trap." },
    ]);
    assert.deepEqual(result.scoring_signals, {
      correct_demonstrates: [],
      incorrect_indicates: [
        { type: "c3_incorrect", value: "NOT_TRUE" },
        { type: "wal_tag", value: "WAL-HS-031" },
      ],
      observed_modifiers: [],
    });
    assert.deepEqual(result.immediate_queue_proposal, {
      type: "enqueue_immediate",
      item_id: "LMS-B-REPAIR-1",
      item_version: "1.0.0",
      label: "Repair card added",
      mandatory: true,
      dependency_free: true,
      origin_branch_id: "BR-B",
      origin_queue_entry_id: "lq_1",
    });
    assert.deepEqual(result.next_action_summary, {
      type: "queued",
      label: "Repair card added",
    });
    assert.deepEqual(result.attempt_event, {
      served_snapshot_id: "snap_1",
      queue_entry_id: "lq_1",
      item_id: "LM-100",
      item_version: "1.0.0",
      selected_response: "B",
      correctness: "incorrect",
      branch_id: "BR-B",
      scoring_signals: result.scoring_signals,
    });
    assert.equal("branch_private" in result, false);
    assert.equal("future_queue" in result, false);
  });

  it("replays an existing submission for the same idempotency key", () => {
    const snapshot = servedSnapshot();
    const first = evaluateLeadMeSubmit(snapshot, {
      queue_entry_id: "lq_1",
      selected_response: "B",
      idempotency_key: "idem_1",
    });
    const existing: LeadMeSubmissionRecord = {
      student_id: "stu_1",
      queue_entry_id: "lq_1",
      idempotency_key: "idem_1",
      result: first,
    };

    const replay = resolveLeadMeSubmit(
      snapshot,
      { queue_entry_id: "lq_1", selected_response: "A", idempotency_key: "idem_1" },
      existing,
    );

    assert.deepEqual(replay, first);
    assert.equal(replay.correctness, "incorrect");
  });

  it("uses the snapshot answer key even if the latest authored item changed", () => {
    const snapshot = servedSnapshot();
    snapshot.submit_private.correct = ["A"];
    const latestAuthoredCorrect = "B";

    const result = evaluateLeadMeSubmit(snapshot, {
      queue_entry_id: "lq_1",
      selected_response: latestAuthoredCorrect,
      idempotency_key: "idem_2",
    });

    assert.equal(result.correctness, "incorrect");
    assert.equal(result.branch_id, "BR-B");
  });
});
