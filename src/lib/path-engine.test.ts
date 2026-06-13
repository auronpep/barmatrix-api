import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STALL_MS,
  computeCurrentDay,
  signalSatisfiesStep,
  isStepAvailable,
  computeNextStep,
  buildPathSummary,
  toPublicStep,
  type PathStep,
  type CompletionSignals,
  type PathState,
} from "./path-engine.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function step(
  id: string,
  day: number,
  order: number,
  over: Partial<PathStep> = {},
): PathStep {
  return {
    id,
    day,
    order,
    kind: "micro_read",
    is_milestone: false,
    depends_on: [],
    title: id,
    microcopy: id,
    xp: 5,
    target: { kind: "inline" },
    completion_rule: { kind: "self_declared" },
    ...over,
  };
}

const NOW = new Date("2026-06-08T12:00:00Z");
const idleState: PathState = {
  current_day: null,
  active_step_id: null,
  active_step_shown_at: null,
};

function emptySignals(): CompletionSignals {
  return {
    foundationsCompleted: new Set(),
    quizAttemptCounts: new Map(),
    flashcardReviewCounts: new Map(),
  };
}

// ── computeCurrentDay ────────────────────────────────────────────────────────

describe("computeCurrentDay", () => {
  const enroll = new Date("2026-06-01T12:00:00Z");

  it("is day 1 on the enrollment calendar day", () => {
    assert.equal(computeCurrentDay(enroll, new Date("2026-06-01T23:30:00Z"), 5), 1);
  });

  it("advances by whole UTC days", () => {
    assert.equal(computeCurrentDay(enroll, new Date("2026-06-02T00:10:00Z"), 5), 2);
    assert.equal(computeCurrentDay(enroll, new Date("2026-06-04T08:00:00Z"), 5), 4);
  });

  it("clamps to the authored day count past the last day", () => {
    assert.equal(computeCurrentDay(enroll, new Date("2026-06-30T08:00:00Z"), 5), 5);
  });

  it("never returns below 1 (clock skew before enrollment)", () => {
    assert.equal(computeCurrentDay(enroll, new Date("2026-05-30T08:00:00Z"), 5), 1);
  });
});

// ── signalSatisfiesStep ──────────────────────────────────────────────────────

describe("signalSatisfiesStep", () => {
  it("matches a completed foundations lesson", () => {
    const s = step("x", 1, 1, {
      completion_rule: { kind: "foundations_lesson_complete", lesson_slug: "lesson-01" },
    });
    const sig = emptySignals();
    assert.equal(signalSatisfiesStep(s, sig), false);
    sig.foundationsCompleted.add("lesson-01");
    assert.equal(signalSatisfiesStep(s, sig), true);
  });

  it("requires enough distinct quiz attempts", () => {
    const s = step("x", 1, 1, {
      completion_rule: { kind: "quiz_attempts_count", set_id: "set-1", required: 10 },
    });
    const sig = emptySignals();
    sig.quizAttemptCounts.set("set-1", 9);
    assert.equal(signalSatisfiesStep(s, sig), false);
    sig.quizAttemptCounts.set("set-1", 10);
    assert.equal(signalSatisfiesStep(s, sig), true);
  });

  it("requires the full deck reviewed", () => {
    const s = step("x", 1, 1, {
      completion_rule: { kind: "flashcard_deck_reviewed", deck_id: "d", required: 10 },
    });
    const sig = emptySignals();
    sig.flashcardReviewCounts.set("d", 10);
    assert.equal(signalSatisfiesStep(s, sig), true);
  });

  it("never satisfies a self_declared step from a signal", () => {
    const s = step("x", 1, 1);
    assert.equal(signalSatisfiesStep(s, emptySignals()), false);
  });
});

// ── isStepAvailable ──────────────────────────────────────────────────────────

describe("isStepAvailable", () => {
  it("non-gated steps are always available", () => {
    assert.equal(isStepAvailable(step("a", 1, 1), { doctrinalApproved: false }), true);
  });

  it("a gated quiz is available only once question_ids are loaded", () => {
    const empty = step("q", 1, 1, {
      kind: "quiz_set",
      attorney_gated: true,
      target: { kind: "quiz", set_id: "s", question_ids: [] },
    });
    const loaded = step("q", 1, 1, {
      kind: "quiz_set",
      attorney_gated: true,
      target: { kind: "quiz", set_id: "s", question_ids: ["a", "b"] },
    });
    assert.equal(isStepAvailable(empty, { doctrinalApproved: false }), false);
    assert.equal(isStepAvailable(loaded, { doctrinalApproved: false }), true);
  });

  it("a gated doctrinal lesson follows the approval flag", () => {
    const s = step("d", 1, 1, {
      kind: "doctrinal_lesson",
      attorney_gated: true,
      target: { kind: "doctrinal", slug: "x" },
    });
    assert.equal(isStepAvailable(s, { doctrinalApproved: false }), false);
    assert.equal(isStepAvailable(s, { doctrinalApproved: true }), true);
  });
});

// ── computeNextStep ──────────────────────────────────────────────────────────

describe("computeNextStep", () => {
  const enroll = new Date("2026-06-08T08:00:00Z"); // currentDay = 1 at NOW
  const base = {
    completedIds: new Set<string>(),
    unavailableIds: new Set<string>(),
    state: idleState,
    enrollmentDate: enroll,
    now: NOW,
    dayCount: 3,
  };

  it("serves today's lowest-order open step", () => {
    const steps = [step("a", 1, 1), step("b", 1, 2)];
    const r = computeNextStep({ ...base, steps });
    assert.equal(r.step?.id, "a");
    assert.equal(r.source, "today");
    assert.equal(r.is_fallback, false);
  });

  it("respects dependencies (skips a lower-order step whose deps aren't met)", () => {
    const steps = [step("a", 1, 1, { depends_on: ["b"] }), step("b", 1, 2)];
    const r = computeNextStep({ ...base, steps });
    assert.equal(r.step?.id, "b");
  });

  it("skips unavailable (gated) steps and routes around them", () => {
    const steps = [step("q", 1, 1), step("a", 1, 2)];
    const r = computeNextStep({
      ...base,
      steps,
      unavailableIds: new Set(["q"]),
    });
    assert.equal(r.step?.id, "a");
  });

  it("15-min stall fallback swaps to a different dependency-free step", () => {
    const steps = [step("a", 1, 1), step("b", 1, 2), step("c", 1, 3, { depends_on: ["a"] })];
    const state: PathState = {
      current_day: 1,
      active_step_id: "a",
      active_step_shown_at: new Date(NOW.getTime() - STALL_MS),
    };
    const r = computeNextStep({ ...base, steps, state });
    assert.equal(r.step?.id, "b");
    assert.equal(r.is_fallback, true);
  });

  it("does NOT fall back before the stall threshold", () => {
    const steps = [step("a", 1, 1), step("b", 1, 2)];
    const state: PathState = {
      current_day: 1,
      active_step_id: "a",
      active_step_shown_at: new Date(NOW.getTime() - (STALL_MS - 1000)),
    };
    const r = computeNextStep({ ...base, steps, state });
    assert.equal(r.step?.id, "a");
    assert.equal(r.is_fallback, false);
  });

  it("does NOT fall back when there is no dependency-free alternative", () => {
    const steps = [step("a", 1, 1), step("c", 1, 2, { depends_on: ["a"] })];
    const state: PathState = {
      current_day: 1,
      active_step_id: "a",
      active_step_shown_at: new Date(NOW.getTime() - STALL_MS),
    };
    const r = computeNextStep({ ...base, steps, state });
    assert.equal(r.step?.id, "a");
    assert.equal(r.is_fallback, false);
  });

  it("serves backlog only after today's set is exhausted, oldest first", () => {
    const steps = [step("d1a", 1, 1), step("d2a", 2, 1)];
    // currentDay = 2; today (d2a) still open -> served first.
    const day2Enroll = new Date("2026-06-07T08:00:00Z");
    const today = computeNextStep({ ...base, steps, enrollmentDate: day2Enroll });
    assert.equal(today.step?.id, "d2a");
    assert.equal(today.source, "today");
    // Finish today's step -> backlog (day 1) overflows.
    const backlog = computeNextStep({
      ...base,
      steps,
      enrollmentDate: day2Enroll,
      completedIds: new Set(["d2a"]),
    });
    assert.equal(backlog.step?.id, "d1a");
    assert.equal(backlog.source, "backlog");
  });

  it("returns null when nothing open remains (graduated)", () => {
    const steps = [step("a", 1, 1), step("b", 1, 2)];
    const r = computeNextStep({ ...base, steps, completedIds: new Set(["a", "b"]) });
    assert.equal(r.step, null);
    assert.equal(r.source, null);
  });
});

// ── buildPathSummary ─────────────────────────────────────────────────────────

describe("buildPathSummary", () => {
  it("counts available steps and flags milestones, excluding gated", () => {
    const steps = [
      step("a", 1, 1, { is_milestone: true }),
      step("q", 1, 2, { is_milestone: true }),
      step("b", 1, 3),
    ];
    const summary = buildPathSummary({
      steps,
      completedIds: new Set(["a"]),
      unavailableIds: new Set(["q"]),
      currentDay: 1,
    });
    assert.equal(summary.total_steps, 2); // a, b (q excluded)
    assert.equal(summary.completed_steps, 1);
    assert.equal(summary.day_total_steps, 2);
    assert.equal(summary.day_completed_steps, 1);
    assert.equal(summary.day_complete, false);
    assert.equal(summary.milestones.length, 2); // both milestones listed
    const q = summary.milestones.find((m) => m.step_id === "q");
    assert.equal(q?.available, false);
  });
});

// ── toPublicStep ─────────────────────────────────────────────────────────────

describe("toPublicStep", () => {
  it("drops completion_rule, carries target + fallback flags", () => {
    const s = step("a", 1, 1, {
      target: { kind: "quiz", set_id: "s", question_ids: ["x"] },
      completion_rule: { kind: "quiz_attempts_count", set_id: "s", required: 1 },
    });
    const pub = toPublicStep({ step: s, source: "today", is_fallback: true });
    assert.ok(pub);
    assert.equal(pub.id, "a");
    assert.equal(pub.is_fallback, true);
    assert.equal(pub.source, "today");
    assert.deepEqual(pub.target, { kind: "quiz", set_id: "s", question_ids: ["x"] });
    assert.equal("completion_rule" in pub, false);
  });

  it("returns null for an empty next step", () => {
    assert.equal(toPublicStep({ step: null, source: null, is_fallback: false }), null);
  });
});
