import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  confusionInputSchema,
  confusionPatchSchema,
  buildConfusionTagRows,
  computeConfusionSignals,
  type ConfusionTagJoinRow,
  type QuestionChoiceRef,
} from "./confusion.js";

const QID = {
  A: "11111111-1111-4111-8111-111111111111",
  B: "22222222-2222-4222-8222-222222222222",
  C: "33333333-3333-4333-8333-333333333333",
  D: "44444444-4444-4444-8444-444444444444",
};

const CHOICES: QuestionChoiceRef[] = [
  { choice_id: QID.A, letter: "A", is_correct: 0 },
  { choice_id: QID.B, letter: "B", is_correct: 1 }, // the key
  { choice_id: QID.C, letter: "C", is_correct: 0 },
  { choice_id: QID.D, letter: "D", is_correct: 0 },
];

describe("confusionInputSchema", () => {
  it("defaults empty buckets and accepts a valid disjoint payload", () => {
    const parsed = confusionInputSchema.parse({
      eliminated: [QID.A],
      deciding_between: [QID.B, QID.D],
      source: "pre_submit",
    });
    assert.deepEqual(parsed.eliminated, [QID.A]);
    assert.deepEqual(parsed.deciding_between, [QID.B, QID.D]);
    assert.equal(parsed.source, "pre_submit");
  });

  it("rejects a choice that is in both buckets (disjointness)", () => {
    const r = confusionInputSchema.safeParse({
      eliminated: [QID.A, QID.B],
      deciding_between: [QID.B],
      source: "pre_submit",
    });
    assert.equal(r.success, false);
  });

  it("rejects a non-uuid choice id", () => {
    const r = confusionInputSchema.safeParse({
      eliminated: ["nope"],
      deciding_between: [],
      source: "pre_submit",
    });
    assert.equal(r.success, false);
  });

  it("patch schema defaults source to retrospective and forbids pre_submit", () => {
    assert.equal(
      confusionPatchSchema.parse({ eliminated: [], deciding_between: [] }).source,
      "retrospective",
    );
    assert.equal(
      confusionPatchSchema.safeParse({
        eliminated: [],
        deciding_between: [],
        source: "pre_submit",
      }).success,
      false,
    );
  });
});

describe("buildConfusionTagRows", () => {
  it("maps choice_ids to rows with letter + is_selected", () => {
    const { rows, dropped, overlap } = buildConfusionTagRows(
      CHOICES,
      { eliminated: [QID.A, QID.C], deciding_between: [QID.B, QID.D] },
      QID.D, // selected
    );
    assert.equal(dropped.length, 0);
    assert.equal(overlap.length, 0);
    assert.equal(rows.length, 4);
    const d = rows.find((r) => r.choice_id === QID.D);
    assert.deepEqual(
      { bucket: d?.bucket, letter: d?.letter, is_selected: d?.is_selected },
      { bucket: "deciding_between", letter: "D", is_selected: true },
    );
    assert.equal(rows.find((r) => r.choice_id === QID.A)?.is_selected, false);
  });

  it("reports choice_ids that do not belong to the question as dropped", () => {
    const alien = "99999999-9999-4999-8999-999999999999";
    const { rows, dropped } = buildConfusionTagRows(
      CHOICES,
      { eliminated: [QID.A, alien], deciding_between: [] },
      null,
    );
    assert.deepEqual(dropped, [alien]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.choice_id, QID.A);
  });

  it("flags overlap and yields it to the eliminated bucket", () => {
    const { rows, overlap } = buildConfusionTagRows(
      CHOICES,
      { eliminated: [QID.B], deciding_between: [QID.B] },
      null,
    );
    assert.deepEqual(overlap, [QID.B]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.bucket, "eliminated");
  });
});

describe("computeConfusionSignals", () => {
  function row(
    over: Partial<ConfusionTagJoinRow> & {
      attempt_id: string;
      bucket: string;
      is_correct: 0 | 1;
      attempt_correct: 0 | 1;
    },
  ): ConfusionTagJoinRow {
    return {
      choice_id: over.choice_id ?? `${over.attempt_id}-${over.bucket}-${over.is_correct}`,
      letter: over.letter ?? "X",
      external_id: over.external_id ?? "EVID-001",
      subject: over.subject ?? "Evidence",
      subtopic: over.subtopic ?? "Hearsay",
      forensic_tags: over.forensic_tags ?? ["legally_true_but_irrelevant"],
      ...over,
    };
  }

  it("detects eliminated-the-key (ruled out the correct choice)", () => {
    const rows = [
      row({ attempt_id: "a1", bucket: "eliminated", is_correct: 1, attempt_correct: 0, letter: "B" }),
      row({ attempt_id: "a1", bucket: "deciding_between", is_correct: 0, attempt_correct: 0, letter: "C" }),
    ];
    const s = computeConfusionSignals(rows);
    assert.equal(s.eliminated_key_count, 1);
    assert.equal(s.eliminated_key[0]?.letter, "B");
  });

  it("counts a lucky guess (correct with >=2 in the deciding set)", () => {
    const rows = [
      row({ attempt_id: "a2", bucket: "deciding_between", is_correct: 1, attempt_correct: 1, letter: "B" }),
      row({ attempt_id: "a2", bucket: "deciding_between", is_correct: 0, attempt_correct: 1, letter: "D" }),
    ];
    const s = computeConfusionSignals(rows);
    assert.equal(s.captured_attempts, 1);
    assert.equal(s.lucky_guess_count, 1);
    assert.equal(s.lucky_guess_rate, 1);
  });

  it("counts a coin-flip wrong and builds the confusion pair", () => {
    const rows = [
      row({ attempt_id: "a3", bucket: "deciding_between", is_correct: 1, attempt_correct: 0, letter: "B", choice_id: "key" }),
      row({ attempt_id: "a3", bucket: "deciding_between", is_correct: 0, attempt_correct: 0, letter: "D", choice_id: "distractor" }),
    ];
    const s = computeConfusionSignals(rows);
    assert.equal(s.coin_flip_wrong_count, 1);
    assert.equal(s.top_confusion_pairs.length, 1);
    assert.equal(s.top_confusion_pairs[0]?.distractor_letter, "D");
    assert.equal(s.top_confusion_pairs[0]?.correct_letter, "B");
    assert.equal(s.top_confusion_pairs[0]?.count, 1);
  });

  it("returns zeros for no rows", () => {
    const s = computeConfusionSignals([]);
    assert.equal(s.captured_attempts, 0);
    assert.equal(s.lucky_guess_rate, 0);
    assert.deepEqual(s.top_confusion_pairs, []);
  });
});
