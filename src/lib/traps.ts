// Trap Taxonomy retrieval helpers — Web Component 02
// (HANDOFFS/WEB/02-trap-taxonomy.md, parent HANDOFFS/15_FIVE_COMPONENT_WEB_BUILDOUT.md).
//
// The Trap Taxonomy surfaces the wrong-answer architectures the MBE deploys.
// Source data lives on the WRONG answer choices (is_correct = 0):
//   - answer_choices.forensic_tags      → the architecture (how the distractor is built)
//   - answer_choices.misconception_tags → the student error it preys on
// Both columns are JSON arrays of slug strings (see SEED_HEARSAY_SEAM.sql, e.g.
// HS-001 choice A forensic_tags = ["purpose_of_offer_confusion","hearsay_reflex"]).
//
// The "official" list is the locked 23 wrong_answer_architecture_tags from
// BARMATRIX/product/TAXONOMY_SOURCE_OF_TRUTH.json. Slugs observed in the bank but
// not on that list are surfaced as "observed in bank" (official = false).
//
// All SQL is MySQL 8 (Hostinger, see src/db.ts): JSON_TABLE unnests the arrays
// for the slug catalog; JSON_CONTAINS(col, JSON_QUOTE($1)) tests membership —
// the same containment idiom already used in lib/knowledge.ts. Queries use $n
// placeholders that db.ts rewrites to positional `?`.

export type TrapKind = "forensic" | "misconception";

// Canonical wrong-answer architecture slugs — mirrored from
// BARMATRIX/product/TAXONOMY_SOURCE_OF_TRUTH.json ("wrong_answer_architecture_tags").
// barmatrix-api is a separate deployable that cannot read across into the BMO
// content tree at runtime, so the LOCKED list is copied here. Keep in sync if the
// taxonomy is re-versioned (a locked decision; changes go through an ADR).
export const OFFICIAL_WRONG_ANSWER_ARCHITECTURES: ReadonlySet<string> = new Set([
  "correct_answer",
  "attractive_wrong_answer",
  "legally_true_but_irrelevant",
  "overbroad_rule",
  "misstated_rule",
  "wrong_party",
  "wrong_timing",
  "wrong_standard",
  "wrong_remedy",
  "wrong_jurisdiction",
  "wrong_mental_state",
  "wrong_procedural_posture",
  "exception_omitted",
  "exception_over_applied",
  "fact_not_in_evidence",
  "answer_to_different_question",
  "common_student_myth",
  "half_right_answer",
  "sounds_lawyerly",
  "moral_common_sense_answer",
  "bar_exam_bait",
  "purpose_of_offer_confusion",
  "exception_hunting",
]);

// Real bank slugs include hyphenated/coded values (e.g. "physical-injury-required",
// "M-TORT-IT-001"), so the handoff's stricter ^[a-z0-9_]+$ would reject valid
// traps. This pattern stays injection-safe (no quotes/spaces/JSON metachars; the
// value is still bound through JSON_QUOTE) while accepting observed slugs.
const TRAP_SLUG_RE = /^[A-Za-z0-9_-]{1,128}$/;

const DEFAULT_EXAMPLES_LIMIT = 20;
export const DEFAULT_TRAP_QUESTIONS_LIMIT = 25;
export const MAX_TRAP_QUESTIONS_LIMIT = 100;

export class TrapInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrapInputError";
  }
}

export interface TrapQuery {
  sql: string;
  values: unknown[];
}

// "correct_answer" is a forensic tag carried only by the CORRECT choice, which
// every trap query filters out via is_correct = 0. It is therefore never a trap
// and is excluded from browsing even though it appears in the canonical list.
export function isOfficialTrap(slug: string): boolean {
  return slug !== "correct_answer" && OFFICIAL_WRONG_ANSWER_ARCHITECTURES.has(slug);
}

// Provenance/meta tags that ride along on most wrong choices to record HOW the
// distractor's explanation was produced — not how the wrong answer is built.
// source_combined_explanation alone tags ~1,800 questions / ~5,200 choices, so
// it is near-universal and would otherwise sit atop the catalog ahead of every
// real architecture. These are excluded from browsing, like correct_answer. The
// whole `source_` namespace is reserved for provenance, so future source_* tags
// drop out automatically.
export const NON_DISCRIMINATING_TRAP_SLUGS: readonly string[] = [
  "source_combined_explanation",
  "source_combined_explanation_fallback",
];

const NON_DISCRIMINATING_TRAP_SET: ReadonlySet<string> = new Set(
  NON_DISCRIMINATING_TRAP_SLUGS,
);

export function isNonDiscriminatingTrapSlug(slug: string): boolean {
  return NON_DISCRIMINATING_TRAP_SET.has(slug) || slug.startsWith("source_");
}

export function humanizeTrapSlug(slug: string): string {
  const cleaned = slug.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return slug;
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function normalizeTrapSlug(raw: unknown): string {
  const value =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
        ? String(raw[0] ?? "").trim()
        : "";
  if (!value || !TRAP_SLUG_RE.test(value)) {
    throw new TrapInputError("invalid trap slug");
  }
  return value;
}

// include_hidden is honored only outside production (parent handoff cross-cutting
// contract #1). In production, hidden bank rows never leak to a read surface.
export function resolveIncludeHidden(
  raw: unknown,
  nodeEnv: string | undefined,
): boolean {
  if (nodeEnv === "production") return false;
  const text =
    typeof raw === "string"
      ? raw.trim().toLowerCase()
      : Array.isArray(raw)
        ? String(raw[0] ?? "").trim().toLowerCase()
        : "";
  return text === "1" || text === "true" || text === "yes";
}

export function clampTrapQuestionsLimit(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return DEFAULT_TRAP_QUESTIONS_LIMIT;
  return Math.max(1, Math.min(MAX_TRAP_QUESTIONS_LIMIT, Math.trunc(raw)));
}

export function clampTrapPage(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.trunc(raw));
}

// Status literals are fixed code constants (never user input), so they are inlined
// rather than parameterized — mirroring the fixed status lists in lib/knowledge.ts.
function statusPredicate(alias: string, includeHidden: boolean): string {
  return includeHidden
    ? `${alias}.status IN ('active', 'hidden')`
    : `${alias}.status = 'active'`;
}

// ---- list ----

export function buildTrapListQuery(includeHidden: boolean): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT t.slug,
             t.kind,
             COUNT(DISTINCT t.question_id) AS question_count,
             COUNT(DISTINCT t.choice_id)   AS choice_count
        FROM (
          SELECT ac.question_id, ac.choice_id, jt.slug, 'forensic' AS kind
            FROM answer_choices ac
            JOIN questions q ON q.question_id = ac.question_id
            JOIN JSON_TABLE(
                   ac.forensic_tags, '$[*]' COLUMNS (slug VARCHAR(255) PATH '$')
                 ) jt
           WHERE ac.is_correct = 0 AND ${status}
          UNION ALL
          SELECT ac.question_id, ac.choice_id, jt.slug, 'misconception' AS kind
            FROM answer_choices ac
            JOIN questions q ON q.question_id = ac.question_id
            JOIN JSON_TABLE(
                   ac.misconception_tags, '$[*]' COLUMNS (slug VARCHAR(255) PATH '$')
                 ) jt
           WHERE ac.is_correct = 0 AND ${status}
        ) t
       WHERE t.slug IS NOT NULL AND t.slug <> '' AND t.slug <> 'correct_answer'
         AND t.slug NOT IN (${NON_DISCRIMINATING_TRAP_SLUGS.map((s) => `'${s}'`).join(", ")})
       GROUP BY t.slug, t.kind
       ORDER BY question_count DESC, t.slug ASC`,
    values: [],
  };
}

// ---- detail ----

export function buildTrapExamplesQuery(
  slug: string,
  includeHidden: boolean,
  limit: number = DEFAULT_EXAMPLES_LIMIT,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT q.question_id,
             q.external_id,
             q.subject,
             q.topic,
             q.subtopic,
             ac.letter,
             ac.choice_text,
             ac.why_attractive,
             ac.why_wrong_or_correct,
             ac.future_cue,
             JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))      AS in_forensic,
             JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1)) AS in_misconception
        FROM answer_choices ac
        JOIN questions q ON q.question_id = ac.question_id
       WHERE ${status}
         AND ac.is_correct = 0
         AND (
           JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))
           OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1))
         )
       ORDER BY q.external_id ASC, ac.letter ASC
       LIMIT $2`,
    values: [slug, limit],
  };
}

export function buildTrapSubjectDistributionQuery(
  slug: string,
  includeHidden: boolean,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT q.subject, COUNT(DISTINCT q.question_id) AS question_count
        FROM answer_choices ac
        JOIN questions q ON q.question_id = ac.question_id
       WHERE ${status}
         AND ac.is_correct = 0
         AND (
           JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))
           OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1))
         )
       GROUP BY q.subject
       ORDER BY question_count DESC, q.subject ASC`,
    values: [slug],
  };
}

// ---- questions (paged distinct questions that use the trap as a distractor) ----

export function buildTrapQuestionsQuery(
  slug: string,
  includeHidden: boolean,
  limit: number,
  offset: number,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT q.question_id, q.external_id, q.subject, q.topic, q.subtopic, q.tension_point
        FROM questions q
       WHERE ${status}
         AND EXISTS (
           SELECT 1
             FROM answer_choices ac
            WHERE ac.question_id = q.question_id
              AND ac.is_correct = 0
              AND (
                JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))
                OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1))
              )
         )
       ORDER BY q.external_id ASC, q.question_id ASC
       LIMIT $2 OFFSET $3`,
    values: [slug, limit, offset],
  };
}

export function buildTrapQuestionsCountQuery(
  slug: string,
  includeHidden: boolean,
): TrapQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT COUNT(*) AS total
        FROM questions q
       WHERE ${status}
         AND EXISTS (
           SELECT 1
             FROM answer_choices ac
            WHERE ac.question_id = q.question_id
              AND ac.is_correct = 0
              AND (
                JSON_CONTAINS(ac.forensic_tags, JSON_QUOTE($1))
                OR JSON_CONTAINS(ac.misconception_tags, JSON_QUOTE($1))
              )
         )`,
    values: [slug],
  };
}

// ---- row + response types ----

export interface TrapListRow {
  slug: string;
  kind: TrapKind;
  question_count: number | string;
  choice_count: number | string;
}

export interface TrapEntry {
  slug: string;
  name: string;
  official: boolean;
  question_count: number;
  choice_count: number;
}

export interface TrapListResponse {
  architecture: TrapEntry[];
  misconception: TrapEntry[];
  totals: {
    architecture_count: number;
    misconception_count: number;
    official_count: number;
  };
}

export interface TrapExampleRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  letter: string;
  choice_text: string;
  why_attractive: string | null;
  why_wrong_or_correct: string | null;
  future_cue: string | null;
  in_forensic: number | string | null;
  in_misconception: number | string | null;
}

export interface TrapSubjectRow {
  subject: string;
  question_count: number | string;
}

export interface TrapExample {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  letter: string;
  choice_text: string;
  why_attractive: string | null;
  why_wrong: string | null;
  future_cue: string | null;
  kinds: TrapKind[];
}

export interface TrapSubjectCount {
  subject: string;
  question_count: number;
}

export interface TrapDetailResponse {
  slug: string;
  name: string;
  official: boolean;
  kinds: TrapKind[];
  question_count: number;
  subject_distribution: TrapSubjectCount[];
  examples: TrapExample[];
  examples_truncated: boolean;
}

export interface TrapQuestionRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  tension_point: string | null;
}

export interface TrapQuestionsResponse {
  slug: string;
  page: number;
  limit: number;
  total: number;
  questions: TrapQuestionRow[];
}

// ---- shapers ----

export function shapeTrapList(rows: TrapListRow[]): TrapListResponse {
  const architecture: TrapEntry[] = [];
  const misconception: TrapEntry[] = [];
  const officialSlugs = new Set<string>();

  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug : "";
    // Never surface a trap the user cannot open or that isn't a real architecture:
    // the correct-answer tag, provenance/meta tags, and malformed slugs (e.g. the
    // comma-joined compound elements found in forensic_tags) that the detail route
    // rejects via normalizeTrapSlug/TRAP_SLUG_RE. Defense-in-depth alongside the
    // SQL exclusions so a slug that slips through aggregation still never lists.
    if (!slug || slug === "correct_answer") continue;
    if (isNonDiscriminatingTrapSlug(slug)) continue;
    if (!TRAP_SLUG_RE.test(slug)) continue;
    const official = isOfficialTrap(slug);
    const entry: TrapEntry = {
      slug,
      name: humanizeTrapSlug(slug),
      official,
      question_count: Number(row.question_count) || 0,
      choice_count: Number(row.choice_count) || 0,
    };
    if (row.kind === "misconception") {
      misconception.push(entry);
    } else {
      architecture.push(entry);
    }
    if (official) officialSlugs.add(slug);
  }

  return {
    architecture,
    misconception,
    totals: {
      architecture_count: architecture.length,
      misconception_count: misconception.length,
      official_count: officialSlugs.size,
    },
  };
}

export function shapeTrapDetail(
  slug: string,
  exampleRows: TrapExampleRow[],
  subjectRows: TrapSubjectRow[],
  examplesLimit: number = DEFAULT_EXAMPLES_LIMIT,
): TrapDetailResponse {
  const examples: TrapExample[] = exampleRows.map((row) => {
    const kinds: TrapKind[] = [];
    if (truthyFlag(row.in_forensic)) kinds.push("forensic");
    if (truthyFlag(row.in_misconception)) kinds.push("misconception");
    return {
      question_id: row.question_id,
      external_id: row.external_id,
      subject: row.subject,
      topic: row.topic,
      subtopic: row.subtopic,
      letter: row.letter,
      choice_text: row.choice_text,
      why_attractive: row.why_attractive,
      why_wrong: row.why_wrong_or_correct,
      future_cue: row.future_cue,
      kinds,
    };
  });

  const subject_distribution: TrapSubjectCount[] = subjectRows.map((row) => ({
    subject: row.subject,
    question_count: Number(row.question_count) || 0,
  }));

  // A question carries exactly one subject, so distinct-question counts summed
  // across subjects equal the trap's total distinct-question count.
  const question_count = subject_distribution.reduce(
    (sum, row) => sum + row.question_count,
    0,
  );

  const kinds = new Set<TrapKind>();
  for (const example of examples) {
    for (const kind of example.kinds) kinds.add(kind);
  }

  return {
    slug,
    name: humanizeTrapSlug(slug),
    official: isOfficialTrap(slug),
    kinds: [...kinds],
    question_count,
    subject_distribution,
    examples,
    examples_truncated: examples.length >= examplesLimit,
  };
}

export function shapeTrapQuestions(
  slug: string,
  page: number,
  limit: number,
  total: number,
  rows: TrapQuestionRow[],
): TrapQuestionsResponse {
  return {
    slug,
    page,
    limit,
    total,
    questions: rows.map((row) => ({
      question_id: row.question_id,
      external_id: row.external_id,
      subject: row.subject,
      topic: row.topic,
      subtopic: row.subtopic,
      tension_point: row.tension_point,
    })),
  };
}

function truthyFlag(value: number | string | null): boolean {
  if (value === null || value === undefined) return false;
  return Number(value) === 1;
}
