import assert from "node:assert/strict";
import { describe, it } from "node:test";

// lib/foundations.ts is pure (no db/config import), so no env stubs are needed.
const {
  getCourse,
  getLessonBySlug,
  isValidLessonSlug,
  shapeOutline,
  summarizeProgress,
  shapeLessonResponse,
  normalizeProgressUpdate,
  indexProgress,
  publicizeLesson,
  findGradedItem,
} = await import("./foundations.js");

// Fields that must NEVER reach a wire response (they are the answer key).
const ANSWER_FIELDS = [
  "correct_status",
  "correct_choice_id",
  "choice_statuses",
  "short_explanation",
  "why_tempting",
  "say_the_break",
] as const;

const completed = (slug: string) => ({
  lesson_slug: slug,
  status: "completed",
  drills_completed: ["1.1", "1.2"],
  completed_at: "2026-05-30T00:00:00.000Z",
  updated_at: "2026-05-30T00:00:00.000Z",
});

describe("foundations content", () => {
  it("ships a 14-lesson course with 5 parts and 700 drill items", () => {
    const c = getCourse();
    assert.equal(c.lesson_count, 14);
    assert.equal(c.lessons.length, 14);
    assert.equal(c.parts.length, 5);
    assert.equal(c.drill_item_count, 700);
    for (const l of c.lessons) {
      assert.equal(l.drills.length, 5);
      assert.ok(l.body_md.length > 500);
      assert.ok(l.objective.length > 0);
      for (const d of l.drills) {
        assert.ok(d.items.length >= 5);
        assert.ok(d.key_md.length > 0);
      }
    }
  });

  it("resolves lessons by slug and validates slug format", () => {
    assert.ok(isValidLessonSlug("lesson-01"));
    assert.ok(!isValidLessonSlug("lesson-1"));
    assert.ok(!isValidLessonSlug("../etc"));
    assert.equal(getLessonBySlug("lesson-01")?.number, 1);
    assert.equal(getLessonBySlug("lesson-99"), null);
  });
});

describe("progress shapers", () => {
  it("outline reports zero progress for an anonymous caller", () => {
    const out = shapeOutline([]);
    assert.equal(out.progress.lessons_completed, 0);
    assert.equal(out.progress.complete, false);
    assert.equal(out.progress.next_slug, "lesson-01");
    assert.equal(out.lessons[0]!.status, "not_started");
  });

  it("merges completion status into the outline and computes the summary", () => {
    const out = shapeOutline([completed("lesson-01"), completed("lesson-02")]);
    assert.equal(out.progress.lessons_completed, 2);
    assert.equal(out.progress.percent, Math.round((2 / 14) * 100));
    assert.equal(out.progress.next_slug, "lesson-03");
    assert.equal(out.lessons[0]!.status, "completed");
    assert.equal(out.lessons[0]!.drills_completed, 2);
    assert.equal(out.lessons[2]!.status, "not_started");
  });

  it("flags the course complete only when all 14 lessons are done", () => {
    const rows = getCourse().lessons.map((l) => completed(l.slug));
    const summary = summarizeProgress(rows);
    assert.equal(summary.lessons_completed, 14);
    assert.equal(summary.complete, true);
    assert.equal(summary.percent, 100);
    assert.equal(summary.next_slug, null);
  });

  it("indexProgress tolerates a JSON-string drills_completed column", () => {
    const idx = indexProgress([
      {
        lesson_slug: "lesson-01",
        status: "in_progress",
        drills_completed: '["1.1","1.3"]',
        completed_at: null,
        updated_at: null,
      },
    ]);
    assert.deepEqual(idx.get("lesson-01")?.drills_completed, ["1.1", "1.3"]);
    assert.equal(idx.get("lesson-01")?.status, "in_progress");
  });

  it("lesson response carries prev/next neighbors and progress", () => {
    const lesson = getLessonBySlug("lesson-02")!;
    const resp = shapeLessonResponse(lesson, completed("lesson-02"));
    assert.equal(resp.prev_slug, "lesson-01");
    assert.equal(resp.next_slug, "lesson-03");
    assert.equal(resp.progress.status, "completed");

    const first = shapeLessonResponse(getLessonBySlug("lesson-01")!, null);
    assert.equal(first.prev_slug, null);
    assert.equal(first.progress.status, "not_started");

    const last = shapeLessonResponse(getLessonBySlug("lesson-14")!, null);
    assert.equal(last.next_slug, null);
  });
});

describe("interactive drills — content gate + answer stripping", () => {
  it("lesson-01 ships 5 gradeable drills of 10 items each in the source module", () => {
    const lesson = getLessonBySlug("lesson-01")!;
    const graded = lesson.drills.filter((d) => d.graded_items?.length);
    assert.equal(graded.length, 5);
    for (const d of graded) {
      assert.equal(d.graded_items!.length, 10);
      assert.ok(d.task_type);
      // The source module carries the full answer key for server-side grading.
      assert.ok(d.graded_items!.every((it) => it.say_the_break.length > 0));
    }
  });

  it("public env (attorney-approved 2026-06-02) serves interactive drills with keys stripped", () => {
    // Pre-approval this asserted a reveal-key fallback (all items pending). After the
    // attorney pass, approved graded drills are served interactively in public too —
    // answer fields stripped (toPublicItem) and the markdown key suppressed.
    const lesson = getLessonBySlug("lesson-01")!;
    const view = publicizeLesson(lesson, "public");
    const graded = view.drills.filter((d) => d.graded_items?.length);
    assert.equal(graded.length, 5);
    for (const d of graded) {
      assert.equal(d.key_md, ""); // markdown key suppressed pre-submission
      for (const it of d.graded_items!) {
        const keys = Object.keys(it as Record<string, unknown>);
        for (const f of ANSWER_FIELDS) {
          assert.ok(!keys.includes(f), `${it.id} leaked ${f} in public env`);
        }
        assert.ok(it.prompt.length > 0); // student still gets what they need
      }
    }
  });

  it("internal env serves interactive items with EVERY answer field stripped and key_md blanked", () => {
    const lesson = getLessonBySlug("lesson-01")!;
    const view = publicizeLesson(lesson, "internal");
    const graded = view.drills.filter((d) => d.graded_items?.length);
    assert.equal(graded.length, 5);
    for (const d of graded) {
      assert.equal(d.key_md, ""); // markdown key suppressed
      for (const it of d.graded_items!) {
        const keys = Object.keys(it as Record<string, unknown>);
        for (const f of ANSWER_FIELDS) {
          assert.ok(!keys.includes(f), `${it.id} leaked ${f}`);
        }
        // …but the student still gets what they need to answer.
        assert.ok(it.prompt.length > 0);
      }
    }
  });

  it("findGradedItem returns the FULL answer-bearing item for server grading", () => {
    const lesson = getLessonBySlug("lesson-01")!;
    const item = findGradedItem(lesson, "1.1", "L1-D11-I01");
    assert.ok(item);
    assert.equal(item!.task_type, "TRUTH_CHECK");
    assert.ok(item!.correct_status); // the key IS present server-side
    assert.equal(findGradedItem(lesson, "1.1", "nope"), null);
  });

  it("every parsed lesson-01 item grades CORRECT when fed its own answer key", async () => {
    const { gradeC3Attempt } = await import("./c3-drill.js");
    const lesson = getLessonBySlug("lesson-01")!;
    let graded = 0;
    for (const drill of lesson.drills) {
      for (const item of drill.graded_items ?? []) {
        graded += 1;
        const response = item.correct_status
          ? { selected_status: item.correct_status }
          : {
              selected_choice_id: item.correct_choice_id,
              selected_choice_statuses: item.choice_statuses,
            };
        const result = gradeC3Attempt(item, response);
        assert.equal(result.correct, true, `${item.id} did not grade correct`);
        assert.equal(result.missed_filter, null, `${item.id} flagged a miss`);
        assert.ok(result.explanation.verdict.length > 0, `${item.id} empty verdict`);
        assert.ok(result.explanation.say_the_break.length > 0, `${item.id} empty break`);
      }
    }
    assert.equal(graded, 50); // 5 drills × 10 items
  });
});

describe("normalizeProgressUpdate", () => {
  const lesson = getLessonBySlug("lesson-01")!;

  it("marks completed when status=completed or completed=true", () => {
    assert.equal(normalizeProgressUpdate(lesson, { status: "completed" }).status, "completed");
    assert.equal(normalizeProgressUpdate(lesson, { completed: true }).status, "completed");
    assert.equal(normalizeProgressUpdate(lesson, {}).status, "in_progress");
  });

  it("keeps only real drill ids for the lesson, deduped and sorted", () => {
    const u = normalizeProgressUpdate(lesson, {
      drills_completed: ["1.2", "1.1", "1.1", "9.9", "bogus"],
    });
    assert.deepEqual(u.drills_completed, ["1.1", "1.2"]);
  });

  it("tolerates a malformed body", () => {
    const u = normalizeProgressUpdate(lesson, null);
    assert.equal(u.status, "in_progress");
    assert.deepEqual(u.drills_completed, []);
  });
});
