// Personal Trap Profile retrieval helpers — Web Component 02 personalization.
//
// Derives, per trap slug, how often the SIGNED-IN student fell for it: a wrong
// attempt whose selected distractor carried the slug in forensic_tags or
// misconception_tags. Computed on-the-fly from student_attempts (no schema
// change), mirroring lib/redzones.ts. SQL is MariaDB: JSON_TABLE unnests the
// arrays for the profile; JSON_CONTAINS(col, JSON_QUOTE($n)) tests membership
// for one slug's history. db.ts rewrites $n placeholders to positional `?`.

import {
  humanizeTrapSlug,
  isNonDiscriminatingTrapSlug,
  isOfficialTrap,
  NON_DISCRIMINATING_TRAP_SLUGS,
  type TrapKind,
  type TrapQuery,
} from "./traps.js";

const TRAP_SLUG_RE = /^[A-Za-z0-9_-]{1,128}$/;
const RECENT_OCCURRENCES_LIMIT = 8;

export { TrapInputError, normalizeTrapSlug } from "./traps.js";

function statusPredicate(alias: string, includeHidden: boolean): string {
  return includeHidden
    ? `${alias}.status IN ('active', 'hidden')`
    : `${alias}.status = 'active'`;
}

// Build parameterized IN clause for non-discriminating trap slugs.
// Returns the SQL fragment and values that should be added to the query.
// Note: caller is responsible for adjusting placeholder numbers if other
// parameters are used before this filter.
function nonDiscriminatingTrapFilter(startPlaceholder: number = 1): {
  sql: string;
  values: readonly string[];
} {
  const placeholders = NON_DISCRIMINATING_TRAP_SLUGS.map(
    (_, i) => `$${startPlaceholder + i}`,
  ).join(", ");
  return {
    sql: `t.slug NOT IN (${placeholders})`,
    values: NON_DISCRIMINATING_TRAP_SLUGS,
  };
}

// ---- profile (GET /api/me/traps) ----

export function buildMyTrapProfileQuery(
  studentId: string,
  includeHidden: boolean,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  const nonDisc = nonDiscriminatingTrapFilter(2); // Start after $1 (studentId)
  return {
    sql: `
      SELECT t.slug,
             t.kind,
             COUNT(*)                                           AS fell_count,
             SUM(CASE WHEN t.confidence >= 4 THEN 1 ELSE 0 END) AS confident_fell_count,
             MAX(t.attempted_at)                                AS last_fell_at
        FROM (
          SELECT a.attempt_id, a.confidence, a.attempted_at, jt.slug, 'forensic' AS kind
            FROM student_attempts a
            JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
            JOIN questions q ON q.question_id = a.question_id
            JOIN JSON_TABLE(ac.forensic_tags, '$[*]' COLUMNS (slug VARCHAR(255) PATH '$')) jt
           WHERE a.student_id = $1 AND a.correct = 0 AND ${status}
          UNION ALL
          SELECT a.attempt_id, a.confidence, a.attempted_at, jt.slug, 'misconception' AS kind
            FROM student_attempts a
            JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
            JOIN questions q ON q.question_id = a.question_id
            JOIN JSON_TABLE(ac.misconception_tags, '$[*]' COLUMNS (slug VARCHAR(255) PATH '$')) jt
           WHERE a.student_id = $1 AND a.correct = 0 AND ${status}
        ) t
       WHERE t.slug IS NOT NULL AND t.slug <> '' AND t.slug <> 'correct_answer'
         AND ${nonDisc.sql}
       GROUP BY t.slug, t.kind
       ORDER BY fell_count DESC, t.slug ASC`,
    values: [studentId, ...nonDisc.values],
  };
}

// ---- history (GET /api/me/traps/:slug) ----

export function buildMyTrapAggregateQuery(
  studentId: string,
  slug: string,
  includeHidden: boolean,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT COUNT(*)                                           AS fell_count,
             SUM(CASE WHEN a.confidence >= 4 THEN 1 ELSE 0 END) AS confident_fell_count,
             MIN(a.attempted_at)                                AS first_fell_at,
             MAX(a.attempted_at)                                AS last_fell_at
        FROM student_attempts a
        JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
        JOIN questions q ON q.question_id = a.question_id
       WHERE a.student_id = $1 AND a.correct = 0 AND ${status}
         AND ( JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($2))
            OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($2)) )`,
    values: [studentId, slug],
  };
}

export function buildMyTrapOccurrencesQuery(
  studentId: string,
  slug: string,
  includeHidden: boolean,
  limit: number = RECENT_OCCURRENCES_LIMIT,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT a.attempt_id, a.selected_letter, a.confidence, a.attempted_at,
             q.question_id, q.external_id, q.subject, q.subtopic,
             ac.why_attractive, ac.why_wrong_or_correct, ac.future_cue
        FROM student_attempts a
        JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
        JOIN questions q ON q.question_id = a.question_id
       WHERE a.student_id = $1 AND a.correct = 0 AND ${status}
         AND ( JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($2))
            OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($2)) )
       ORDER BY a.attempted_at DESC
       LIMIT $3`,
    values: [studentId, slug, limit],
  };
}

// ---- row + response types ----

export interface MyTrapProfileRow {
  slug: string;
  kind: TrapKind;
  fell_count: number | string;
  confident_fell_count: number | string | null;
  last_fell_at: string | Date | null;
}

export interface MyTrapEntry {
  slug: string;
  name: string;
  kind: TrapKind;
  official: boolean;
  fell_count: number;
  confident_fell_count: number;
  last_fell_at: string | null;
}

export interface ProfileMetrics {
  distinct_traps: number;
  total_falls: number;
  total_confident_falls: number;
  top_trap_slug: string | null;
}

export interface MyTrapAggregateRow {
  fell_count: number | string;
  confident_fell_count: number | string | null;
  first_fell_at: string | Date | null;
  last_fell_at: string | Date | null;
}

export interface MyTrapOccurrenceRow {
  attempt_id: string;
  question_id: string;
  external_id: string | null;
  subject: string;
  subtopic: string | null;
  selected_letter: string;
  confidence: number | string | null;
  attempted_at: string | Date;
  why_attractive: string | null;
  why_wrong_or_correct: string | null;
  future_cue: string | null;
}

export interface MyTrapOccurrence {
  attempt_id: string;
  question_id: string;
  external_id: string | null;
  subject: string;
  subtopic: string | null;
  selected_letter: string;
  confidence: number | null;
  attempted_at: string;
  why_attractive: string | null;
  why_wrong: string | null;
  future_cue: string | null;
}

export interface MyTrapHistory {
  slug: string;
  name: string;
  official: boolean;
  fell_count: number;
  confident_fell_count: number;
  first_fell_at: string | null;
  last_fell_at: string | null;
  recent: MyTrapOccurrence[];
}

// ---- shapers ----

function toIso(value: string | Date | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function shapeMyTrapProfile(rows: MyTrapProfileRow[]): MyTrapEntry[] {
  const out: MyTrapEntry[] = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug : "";
    if (!slug || slug === "correct_answer") continue;
    if (isNonDiscriminatingTrapSlug(slug)) continue;
    if (!TRAP_SLUG_RE.test(slug)) continue;
    out.push({
      slug,
      name: humanizeTrapSlug(slug),
      kind: row.kind === "misconception" ? "misconception" : "forensic",
      official: isOfficialTrap(slug),
      fell_count: Number(row.fell_count) || 0,
      confident_fell_count: Number(row.confident_fell_count) || 0,
      last_fell_at: toIso(row.last_fell_at),
    });
  }
  out.sort((a, b) =>
    b.fell_count !== a.fell_count
      ? b.fell_count - a.fell_count
      : a.slug.localeCompare(b.slug),
  );
  return out;
}

export function deriveProfileMetrics(traps: MyTrapEntry[]): ProfileMetrics {
  let totalFalls = 0;
  let totalConfident = 0;
  const slugs = new Set<string>();
  for (const t of traps) {
    totalFalls += t.fell_count;
    totalConfident += t.confident_fell_count;
    slugs.add(t.slug);
  }
  return {
    distinct_traps: slugs.size,
    total_falls: totalFalls,
    total_confident_falls: totalConfident,
    top_trap_slug: traps[0]?.slug ?? null,
  };
}

export function shapeMyTrapHistory(
  slug: string,
  agg: MyTrapAggregateRow,
  recentRows: MyTrapOccurrenceRow[],
): MyTrapHistory {
  return {
    slug,
    name: humanizeTrapSlug(slug),
    official: isOfficialTrap(slug),
    fell_count: Number(agg.fell_count) || 0,
    confident_fell_count: Number(agg.confident_fell_count) || 0,
    first_fell_at: toIso(agg.first_fell_at),
    last_fell_at: toIso(agg.last_fell_at),
    recent: recentRows.map((r) => ({
      attempt_id: r.attempt_id,
      question_id: r.question_id,
      external_id: r.external_id,
      subject: r.subject,
      subtopic: r.subtopic,
      selected_letter: r.selected_letter,
      confidence: r.confidence === null ? null : Number(r.confidence),
      attempted_at: toIso(r.attempted_at) ?? "",
      why_attractive: r.why_attractive,
      why_wrong: r.why_wrong_or_correct,
      future_cue: r.future_cue,
    })),
  };
}
