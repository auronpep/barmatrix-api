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
} = await import("./foundations.js");

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
