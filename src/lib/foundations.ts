// Foundations ("The Method" / C3) course — content accessors + progress shapers.
//
// The course is the gated core starter every student works before going deep on
// the bank: 14 lessons (Cut -> Clash -> Call) grouped into 5 parts, each lesson
// carrying 5 self-check drills. The teaching content is AUTHORED, shipped as a
// generated module (foundations.data.ts, built by scripts/build_foundations.py),
// so reads need no database — only per-student PROGRESS is DB-backed.
//
// This file is pure (no Express, no pool) so the shapers unit-test without a DB,
// matching lib/tensions.ts / lib/traps.ts. The routes in routes/foundations.ts
// own the HTTP + SQL.

import { FOUNDATIONS_COURSE } from "./foundations.data.js";

// ---- content types (the shape foundations.data.ts must satisfy) ----

export interface FoundationsDrill {
  id: string;
  title: string;
  instructions_md: string;
  items: readonly string[];
  item_count: number;
  key_md: string;
}

export interface FoundationsLesson {
  slug: string;
  number: number;
  part: string;
  part_title: string;
  title: string;
  objective: string;
  est_minutes: number;
  body_md: string;
  drills: readonly FoundationsDrill[];
  how_to_use_md: string;
  drill_item_count: number;
}

export interface FoundationsPart {
  roman: string;
  title: string;
  lesson_numbers: readonly number[];
}

export interface FoundationsCourse {
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  provenance: string;
  version: string;
  lesson_count: number;
  drill_item_count: number;
  est_total_minutes: number;
  parts: readonly FoundationsPart[];
  lessons: readonly FoundationsLesson[];
}

// ---- progress types ----

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface ProgressRow {
  lesson_slug: string;
  status: string;
  drills_completed: unknown;
  completed_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface LessonProgress {
  status: LessonStatus;
  drills_completed: string[];
  completed_at: string | null;
}

export interface LessonOutlineEntry {
  slug: string;
  number: number;
  part: string;
  part_title: string;
  title: string;
  objective: string;
  est_minutes: number;
  drill_count: number;
  drill_item_count: number;
  status: LessonStatus;
  drills_completed: number;
}

export interface CourseProgressSummary {
  lessons_completed: number;
  lesson_count: number;
  percent: number;
  complete: boolean;
  next_slug: string | null;
}

export interface FoundationsOutlineResponse {
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  provenance: string;
  version: string;
  lesson_count: number;
  drill_item_count: number;
  est_total_minutes: number;
  parts: readonly FoundationsPart[];
  lessons: LessonOutlineEntry[];
  progress: CourseProgressSummary;
}

export interface FoundationsLessonResponse {
  course_slug: string;
  course_title: string;
  lesson: FoundationsLesson;
  prev_slug: string | null;
  next_slug: string | null;
  progress: LessonProgress;
}

// ---- content accessors ----

export function getCourse(): FoundationsCourse {
  return FOUNDATIONS_COURSE;
}

export function getLessonBySlug(slug: string): FoundationsLesson | null {
  return FOUNDATIONS_COURSE.lessons.find((l) => l.slug === slug) ?? null;
}

const LESSON_SLUG_RE = /^lesson-\d{2}$/;

export function isValidLessonSlug(raw: unknown): raw is string {
  return typeof raw === "string" && LESSON_SLUG_RE.test(raw);
}

function neighborSlugs(slug: string): { prev: string | null; next: string | null } {
  const lessons = FOUNDATIONS_COURSE.lessons;
  const idx = lessons.findIndex((l) => l.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  const prev = idx > 0 ? lessons[idx - 1] : undefined;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : undefined;
  return {
    prev: prev ? prev.slug : null,
    next: next ? next.slug : null,
  };
}

// ---- progress normalization ----

function asStringArray(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function normalizeStatus(raw: string | undefined): LessonStatus {
  if (raw === "completed" || raw === "in_progress" || raw === "not_started") return raw;
  return "not_started";
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Index DB progress rows by lesson slug for O(1) merge against the static outline. */
export function indexProgress(rows: ProgressRow[]): Map<string, LessonProgress> {
  const map = new Map<string, LessonProgress>();
  for (const r of rows) {
    map.set(r.lesson_slug, {
      status: normalizeStatus(r.status),
      drills_completed: asStringArray(r.drills_completed),
      completed_at: toIso(r.completed_at),
    });
  }
  return map;
}

// ---- shapers ----

export function shapeOutline(rows: ProgressRow[]): FoundationsOutlineResponse {
  const course = FOUNDATIONS_COURSE;
  const progress = indexProgress(rows);

  const lessons: LessonOutlineEntry[] = course.lessons.map((l) => {
    const p = progress.get(l.slug);
    return {
      slug: l.slug,
      number: l.number,
      part: l.part,
      part_title: l.part_title,
      title: l.title,
      objective: l.objective,
      est_minutes: l.est_minutes,
      drill_count: l.drills.length,
      drill_item_count: l.drill_item_count,
      status: p?.status ?? "not_started",
      drills_completed: p?.drills_completed.length ?? 0,
    };
  });

  return {
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    tagline: course.tagline,
    provenance: course.provenance,
    version: course.version,
    lesson_count: course.lesson_count,
    drill_item_count: course.drill_item_count,
    est_total_minutes: course.est_total_minutes,
    parts: course.parts,
    lessons,
    progress: summarizeProgress(rows),
  };
}

export function summarizeProgress(rows: ProgressRow[]): CourseProgressSummary {
  const course = FOUNDATIONS_COURSE;
  const progress = indexProgress(rows);
  const completedSlugs = new Set(
    course.lessons.filter((l) => progress.get(l.slug)?.status === "completed").map((l) => l.slug),
  );
  const lessonsCompleted = completedSlugs.size;
  const lessonCount = course.lesson_count;
  // First lesson not yet completed is the recommended next step.
  const next = course.lessons.find((l) => !completedSlugs.has(l.slug)) ?? null;
  return {
    lessons_completed: lessonsCompleted,
    lesson_count: lessonCount,
    percent: lessonCount > 0 ? Math.round((lessonsCompleted / lessonCount) * 100) : 0,
    complete: lessonsCompleted >= lessonCount,
    next_slug: next ? next.slug : null,
  };
}

export function shapeLessonResponse(
  lesson: FoundationsLesson,
  row: ProgressRow | null,
): FoundationsLessonResponse {
  const { prev, next } = neighborSlugs(lesson.slug);
  const p = row ? indexProgress([row]).get(lesson.slug) : undefined;
  return {
    course_slug: FOUNDATIONS_COURSE.slug,
    course_title: FOUNDATIONS_COURSE.title,
    lesson,
    prev_slug: prev,
    next_slug: next,
    progress: p ?? { status: "not_started", drills_completed: [], completed_at: null },
  };
}

// ---- write-side helpers ----

export interface ProgressUpdate {
  status: LessonStatus;
  drills_completed: string[];
}

/**
 * Validate + normalize a progress PATCH body against the lesson's real drill ids.
 * Unknown drill ids are dropped (defensive — never trust the client). When the
 * caller marks the lesson completed we record it; otherwise it's in_progress.
 */
export function normalizeProgressUpdate(
  lesson: FoundationsLesson,
  body: unknown,
): ProgressUpdate {
  const b = (body ?? {}) as Record<string, unknown>;
  const validIds = new Set(lesson.drills.map((d) => d.id));
  const drills = asStringArray(b.drills_completed).filter((id) => validIds.has(id));
  const rawStatus = typeof b.status === "string" ? b.status : undefined;
  const completed = rawStatus === "completed" || b.completed === true;
  return {
    status: completed ? "completed" : "in_progress",
    drills_completed: [...new Set(drills)].sort(),
  };
}
