import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DAY_GUIDED_PLANS,
  DAY1_PLAN,
  buildDayPlanSummaries,
  buildLeadMePath,
  catchupCandidatesForRollover,
  contentRefKey,
  programDayKey,
  validateDayPlanManifest,
  type CatchupBankItem,
} from "./day-plan.js";

describe("J7 Day 1 manifest", () => {
  it("is an approved five-milestone, fifty-step guided path", () => {
    const errors = validateDayPlanManifest(DAY1_PLAN);

    assert.deepEqual(errors, []);
    assert.equal(DAY1_PLAN.approved, true);
    assert.equal(DAY1_PLAN.main_items.length, 5);
    assert.equal(DAY1_PLAN.steps.length, 50);
    assert.deepEqual(
      DAY1_PLAN.main_items.map((item) => item.selectable),
      [false, false, false, false, false],
    );
  });

  it("uses student-facing Day 1 titles and content labels instead of internal references", () => {
    const visibleStrings = [
      DAY1_PLAN.title,
      ...DAY1_PLAN.main_items.flatMap((item) => [item.title, item.description]),
      ...DAY1_PLAN.steps.flatMap((step) => [
        step.title,
        step.prompt,
        step.action.label,
        step.content_ref.label ?? "",
      ]),
    ];

    for (const value of visibleStrings) {
      assert.doesNotMatch(value, /Diagnostic [AB](?: question| external question)/i);
      assert.doesNotMatch(value, /\bexternal question\b/i);
      assert.doesNotMatch(value, /\b(?:CRIM|CPA|GP|HOM|INC|OC)-[A-Z0-9-]+\b/);
      assert.doesNotMatch(value, /\bFlashcard \d+\b/i);
      assert.doesNotMatch(value, /\blayer lesson \d+\b/i);
      assert.doesNotMatch(value, /\bmicro-lesson \d+\b/i);
    }

    assert.equal(DAY1_PLAN.steps[0]?.title, "Illegal arrest remedy trap");
    assert.equal(
      DAY1_PLAN.steps[0]?.content_ref.label,
      "Unlawful arrest does not dismiss an indictment",
    );
  });

  it("routes flashcard tasks to the live deck with the matching day-plan step", () => {
    const flashcardSteps = DAY1_PLAN.steps.filter((step) => step.main_item_id === "flashcards");

    assert.equal(flashcardSteps.length, 10);
    for (const [index, step] of flashcardSteps.entries()) {
      const cardId = `c${String(index + 1).padStart(2, "0")}`;
      const expectedHref = `/flashcards/criminal-law-day1?card=${cardId}&step=${step.step_id}`;
      assert.equal(step.action.label, "Open flashcard");
      assert.equal(step.action.href, expectedHref);
      assert.equal(step.content_ref.href, expectedHref);
    }
  });

  it("routes diagnostic and Criminal Law tasks with day-plan completion context", () => {
    const diagnosticSteps = DAY1_PLAN.steps.filter((step) =>
      step.main_item_id === "diagnostic-a" || step.main_item_id === "diagnostic-b",
    );
    const criminalLessonSteps = DAY1_PLAN.steps.filter(
      (step) => step.main_item_id === "criminal-lesson",
    );

    assert.equal(diagnosticSteps.length, 20);
    assert.equal(criminalLessonSteps.length, 10);
    for (const step of diagnosticSteps) {
      const expectedHref = `/diagnostic/session?step=${step.step_id}`;
      assert.equal(step.action.label, "Answer guided question");
      assert.equal(step.action.href, expectedHref);
      assert.equal(step.content_ref.href, expectedHref);
    }
    for (const step of criminalLessonSteps) {
      const expectedHref = `/drills/criminal-law?step=${step.step_id}`;
      assert.equal(step.action.label, "Open guided drill");
      assert.equal(step.action.href, expectedHref);
      assert.equal(step.content_ref.href, expectedHref);
    }
  });

  it("uses the 3 AM local rollover boundary", () => {
    assert.equal(
      programDayKey(new Date("2026-06-08T09:59:00.000Z"), "America/Los_Angeles"),
      "2026-06-07",
    );
    assert.equal(
      programDayKey(new Date("2026-06-08T10:00:00.000Z"), "America/Los_Angeles"),
      "2026-06-08",
    );
  });

  it("selects only unfinished daily micro-tasks for rollover", () => {
    const completed = new Set(DAY1_PLAN.steps.slice(0, 3).map((step) => step.step_id));
    const existing = new Set([contentRefKey(DAY1_PLAN.steps[4]!.content_ref)]);

    const missed = catchupCandidatesForRollover({
      manifest: DAY1_PLAN,
      originalDayKey: "2026-06-07",
      completedStepIds: completed,
      existingCatchupContentRefs: existing,
      missedAt: new Date("2026-06-08T10:00:00.000Z"),
    });

    assert.equal(missed[0]?.original_step_id, DAY1_PLAN.steps[3]?.step_id);
    assert.ok(!missed.some((item) => item.original_step_id === DAY1_PLAN.steps[4]?.step_id));
    assert.ok(!missed.some((item) => completed.has(item.original_step_id)));
  });
});

describe("J7 three-day guided path", () => {
  it("exposes the first three Criminal Law/Procedure guided-day manifests", () => {
    assert.deepEqual(
      DAY_GUIDED_PLANS.map((manifest) => manifest.day_index),
      [1, 2, 3],
    );

    for (const manifest of DAY_GUIDED_PLANS) {
      assert.deepEqual(validateDayPlanManifest(manifest), []);
      assert.equal(manifest.approved, true);
      assert.equal(manifest.approved_at, "2026-06-08");
      assert.equal(manifest.main_items.length, 5);
      assert.equal(manifest.steps.length, 50);
      assert.deepEqual(
        manifest.main_items.map((item) => item.selectable),
        [false, false, false, false, false],
      );
    }
  });

  it("builds three non-selectable day cards without exposing alternate task choices", () => {
    const cards = buildDayPlanSummaries({
      manifests: DAY_GUIDED_PLANS,
      activePlanKey: DAY1_PLAN.plan_key,
      completedPlanKeys: new Set<string>(),
    });

    assert.deepEqual(
      cards.map((card) => card.day_index),
      [1, 2, 3],
    );
    assert.deepEqual(
      cards.map((card) => card.status),
      ["active", "locked", "locked"],
    );
    assert.deepEqual(
      cards.map((card) => card.approved),
      [true, true, true],
    );
    assert.deepEqual(
      cards.map((card) => card.selectable),
      [false, false, false],
    );
    assert.deepEqual(
      cards.map((card) => [card.milestone_count, card.step_count]),
      [
        [5, 50],
        [5, 50],
        [5, 50],
      ],
    );
    assert.deepEqual(
      cards.map((card) => card.title),
      [
        "Day 1: Trap Hunt and C3 Power-Up",
        "Day 2: Gate Builder and Trap Repair",
        "Day 3: Mixed-Set Boss Run",
      ],
    );
    assert.deepEqual(
      cards.map((card) => card.description),
      [
        "Kick off the run: hunt the first remedy traps, unlock C3, and bank your opening streak.",
        "Level up the gates: rescue yesterday's misses, sharpen Procedure moves, and clear mixed traps.",
        "Pressure run: switch Criminal Law and Procedure without handrails, then bridge to the next red zone.",
      ],
    );
    assert.ok(!cards.some((card) => /Orientation, baseline diagnostics/i.test(card.description)));
    assert.ok(!cards.some((card) => /diagnostic and C3 foundation/i.test(card.title)));
  });
});

describe("Lead Me catchup injection", () => {
  it("adds oldest non-duplicate catchup tasks only after completed milestones", () => {
    const completedDaily = new Set(
      DAY1_PLAN.steps
        .filter((step) => step.main_item_id === "diagnostic-a")
        .map((step) => step.step_id),
    );
    const duplicateOfToday = DAY1_PLAN.steps.find(
      (step) => step.main_item_id === "foundations-c3",
    )!;
    const catchup: CatchupBankItem[] = [
      item("catchup-1", "2026-06-05", "oldest", { type: "reflection", id: "oldest" }),
      item("catchup-2", "2026-06-06", "duplicate", duplicateOfToday.content_ref),
      item("catchup-3", "2026-06-06", "second", { type: "reflection", id: "second" }),
      item("catchup-4", "2026-06-06", "third", { type: "reflection", id: "third" }),
    ];

    const path = buildLeadMePath({
      manifest: DAY1_PLAN,
      completedDailyStepIds: completedDaily,
      completedCatchupIds: new Set(),
      catchupBank: catchup,
    });

    const injected = path.steps.filter((step) => step.source === "catchup");
    assert.deepEqual(
      injected.map((step) => step.step_id),
      ["catchup-1", "catchup-3"],
    );
    assert.equal(path.catchup.pending_count, 4);
    assert.equal(path.catchup.injected_count, 2);
    assert.equal(path.current_step?.step_id, "catchup-1");
  });

  it("reports zero progress for an empty manifest", () => {
    const path = buildLeadMePath({
      manifest: {
        plan_key: "empty",
        version: "1",
        day_index: 0,
        title: "Empty",
        approved: true,
        approved_at: "2026-06-19",
        timezone: "America/Los_Angeles",
        rollover_hour: 3,
        main_items: [],
        steps: [],
      },
      completedDailyStepIds: new Set(),
      completedCatchupIds: new Set(),
      catchupBank: [],
    });

    assert.equal(path.metrics.total_daily_steps, 0);
    assert.equal(path.metrics.progress_pct, 0);
  });
});

function item(
  catchupId: string,
  originalDayKey: string,
  title: string,
  contentRef: CatchupBankItem["content_ref"],
): CatchupBankItem {
  return {
    catchup_id: catchupId,
    student_id: "student-1",
    original_day_key: originalDayKey,
    original_step_id: `step-${catchupId}`,
    main_item_id: "diagnostic-a",
    title,
    prompt: "Recovered task",
    kind: "micro_reflection",
    content_ref: contentRef,
    action: { label: "Complete" },
    xp: 5,
    missed_at: "2026-06-08T10:00:00.000Z",
  };
}
