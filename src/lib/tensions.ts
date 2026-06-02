// Tension Map retrieval helpers — Web Component 01 (HANDOFFS/WEB/01-tension-map.md,
// parent HANDOFFS/15_FIVE_COMPONENT_WEB_BUILDOUT.md).
//
// The Tension Map surfaces the recurring legal tension points the MBE reuses.
// There are two data layers, and the surface degrades gracefully across both:
//
//   1. Curated catalog — the `tension_points` table (ids like 'CP-TM-001', a URL
//      `slug`, and rich copy: tension_name, legal_collision, decision_axis...).
//      It ships via the ADDITIVE migration MIGRATION_TENSION_POINTS_MYSQL.sql,
//      which is founder-gated and may be ABSENT in production. Every catalog read
//      therefore tolerates a missing table (isMissingTableError) and falls back to
//      layer 2 with catalog_ready=false.
//
//   2. Observed-in-bank tags — a question links to a tension via the legacy
//      `questions.tension_point` column OR `question_tags(dimension IN
//      ('tension','tension_point'))`. This mirrors the tension linkage already used
//      by routes/drills.ts (selectQuestionIds, kind='tension').
//
// Catalog entries are "official" (curated); observed-only tags are surfaced as
// "observed in bank" (official=false) — the same two-tier model as lib/traps.ts.
//
// All SQL is MySQL 8 (see src/db.ts, which rewrites $n -> positional ?). Values are
// always parameterized; the only interpolated fragments are fixed status literals
// and integer caps that are code constants, never user input (same idiom as
// lib/traps.ts / lib/knowledge.ts).

export const DEFAULT_TENSION_QUESTIONS_LIMIT = 25;
export const MAX_TENSION_QUESTIONS_LIMIT = 100;
const DEFAULT_EXAMPLES_LIMIT = 12;
// The curated catalog is ~84 rows; observed tension tags are bounded by the bank.
const CATALOG_LIMIT = 500;
const OBSERVED_LIMIT = 500;

// Tension values seen in the wild include catalog ids/slugs, dotted bank codes
// ('FM-I.B-*'), semicolon-separated composites, and short prose tags. The value
// is still always bound as a SQL parameter; this validator only limits URL
// params to printable bank-tag punctuation that the list endpoint may emit.
const TENSION_SLUG_RE = /^[A-Za-z0-9_.; +\/-]{1,128}$/;

export class TensionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TensionInputError";
  }
}

export interface TensionQuery {
  sql: string;
  values: unknown[];
}

/**
 * True when a MySQL error is "table doesn't exist" (mysql2 surfaces
 * code='ER_NO_SUCH_TABLE' / errno=1146). The route uses this to treat an
 * unprovisioned tension_points catalog as "no catalog" rather than a 500.
 */
export function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown } | null;
  return (
    !!e && (e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146)
  );
}

export function humanizeTensionSlug(slug: string): string {
  const cleaned = slug.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return slug;
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function normalizeTensionSlug(raw: unknown): string {
  const value =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
        ? String(raw[0] ?? "").trim()
        : "";
  if (!value || !TENSION_SLUG_RE.test(value)) {
    throw new TensionInputError("invalid tension slug");
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
        ? String(raw[0] ?? "")
            .trim()
            .toLowerCase()
        : "";
  return text === "1" || text === "true" || text === "yes";
}

export function clampTensionQuestionsLimit(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return DEFAULT_TENSION_QUESTIONS_LIMIT;
  return Math.max(1, Math.min(MAX_TENSION_QUESTIONS_LIMIT, Math.trunc(raw)));
}

export function clampTensionPage(value: unknown): number {
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
// rather than parameterized — mirroring the fixed status lists in lib/traps.ts.
function statusPredicate(alias: string, includeHidden: boolean): string {
  return includeHidden
    ? `${alias}.status IN ('active', 'hidden')`
    : `${alias}.status = 'active'`;
}

function inPlaceholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `$${start + i}`).join(", ");
}

/**
 * The link keys for a tension. A question is linked when its tension_point column
 * value OR a question_tags(dimension IN ('tension','tension_point')) value matches
 * ANY key. We pass both the URL slug and (when the catalog resolved it) the
 * canonical tension_point_id, because the bank tags by id while URLs use slug.
 */
export function tensionLinkKeys(
  slug: string,
  tensionPointId: string | null,
): string[] {
  const keys = [slug];
  if (tensionPointId && tensionPointId !== slug) keys.push(tensionPointId);
  return keys;
}

// ---- catalog (curated tension_points; may be absent) ----

export function buildTensionCatalogQuery(): TensionQuery {
  return {
    sql: `
      SELECT tension_point_id, slug, subject_code, subject, domain, tension_name,
             legal_collision, decision_axis, common_misconceptions
        FROM tension_points
       WHERE status = 'active'
       ORDER BY subject_code ASC, tension_point_id ASC
       LIMIT ${CATALOG_LIMIT}`,
    values: [],
  };
}

export function buildTensionCatalogRowQuery(slug: string): TensionQuery {
  return {
    sql: `
      SELECT tension_point_id, slug, subject_code, subject, domain, tension_name,
             legal_collision, decision_axis, common_misconceptions
        FROM tension_points
       WHERE slug = $1 OR tension_point_id = $1
       LIMIT 1`,
    values: [slug],
  };
}

// ---- observed-in-bank tension tags (counts + representative subject) ----

export function buildTensionObservedQuery(includeHidden: boolean): TensionQuery {
  const status = statusPredicate("q", includeHidden);
  return {
    sql: `
      SELECT t.tension_value AS tension_value,
             COUNT(DISTINCT t.question_id) AS question_count,
             MIN(t.subject) AS subject
        FROM (
          SELECT q.question_id, q.subject, q.tension_point AS tension_value
            FROM questions q
           WHERE ${status} AND q.tension_point IS NOT NULL AND q.tension_point <> ''
          UNION ALL
          SELECT q.question_id, q.subject, qt.value AS tension_value
            FROM question_tags qt
            JOIN questions q ON q.question_id = qt.question_id
           WHERE ${status}
             AND qt.dimension IN ('tension', 'tension_point')
             AND qt.value IS NOT NULL AND qt.value <> ''
        ) t
       GROUP BY t.tension_value
       ORDER BY question_count DESC, t.tension_value ASC
       LIMIT ${OBSERVED_LIMIT}`,
    values: [],
  };
}

// ---- detail: example questions, subject distribution, paged questions ----

export function buildTensionExamplesQuery(
  keys: string[],
  includeHidden: boolean,
  limit: number = DEFAULT_EXAMPLES_LIMIT,
): TensionQuery {
  const status = statusPredicate("q", includeHidden);
  const n = keys.length;
  const idList = inPlaceholders(1, n);
  const limitParam = `$${n + 1}`;
  return {
    sql: `
      SELECT q.question_id, q.external_id, q.subject, q.topic, q.subtopic, q.question_stem
        FROM questions q
       WHERE ${status}
         AND ( q.tension_point IN (${idList})
            OR EXISTS ( SELECT 1 FROM question_tags qt
                         WHERE qt.question_id = q.question_id
                           AND qt.dimension IN ('tension', 'tension_point')
                           AND qt.value IN (${idList}) ) )
       ORDER BY q.external_id ASC, q.question_id ASC
       LIMIT ${limitParam}`,
    values: [...keys, limit],
  };
}

export function buildTensionSubjectDistributionQuery(
  keys: string[],
  includeHidden: boolean,
): TensionQuery {
  const status = statusPredicate("q", includeHidden);
  const idList = inPlaceholders(1, keys.length);
  return {
    sql: `
      SELECT q.subject, COUNT(DISTINCT q.question_id) AS question_count
        FROM questions q
       WHERE ${status}
         AND ( q.tension_point IN (${idList})
            OR EXISTS ( SELECT 1 FROM question_tags qt
                         WHERE qt.question_id = q.question_id
                           AND qt.dimension IN ('tension', 'tension_point')
                           AND qt.value IN (${idList}) ) )
       GROUP BY q.subject
       ORDER BY question_count DESC, q.subject ASC`,
    values: [...keys],
  };
}

export function buildTensionQuestionsQuery(
  keys: string[],
  includeHidden: boolean,
  limit: number,
  offset: number,
): TensionQuery {
  const status = statusPredicate("q", includeHidden);
  const n = keys.length;
  const idList = inPlaceholders(1, n);
  const limitParam = `$${n + 1}`;
  const offsetParam = `$${n + 2}`;
  return {
    sql: `
      SELECT q.question_id, q.external_id, q.subject, q.topic, q.subtopic, q.tension_point
        FROM questions q
       WHERE ${status}
         AND ( q.tension_point IN (${idList})
            OR EXISTS ( SELECT 1 FROM question_tags qt
                         WHERE qt.question_id = q.question_id
                           AND qt.dimension IN ('tension', 'tension_point')
                           AND qt.value IN (${idList}) ) )
       ORDER BY q.external_id ASC, q.question_id ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values: [...keys, limit, offset],
  };
}

export function buildTensionQuestionsCountQuery(
  keys: string[],
  includeHidden: boolean,
): TensionQuery {
  const status = statusPredicate("q", includeHidden);
  const idList = inPlaceholders(1, keys.length);
  return {
    sql: `
      SELECT COUNT(*) AS total
        FROM questions q
       WHERE ${status}
         AND ( q.tension_point IN (${idList})
            OR EXISTS ( SELECT 1 FROM question_tags qt
                         WHERE qt.question_id = q.question_id
                           AND qt.dimension IN ('tension', 'tension_point')
                           AND qt.value IN (${idList}) ) )`,
    values: [...keys],
  };
}

// ---- row + response types ----

export interface TensionCatalogRow {
  tension_point_id: string;
  slug: string;
  subject_code: string;
  subject: string;
  domain: string | null;
  tension_name: string;
  legal_collision: string | null;
  decision_axis: string | null;
  common_misconceptions: string | null;
}

export interface TensionObservedRow {
  tension_value: string;
  question_count: number | string;
  subject: string | null;
}

export interface TensionEntry {
  slug: string;
  name: string;
  subject: string;
  domain: string | null;
  official: boolean;
  question_count: number;
  tension_point_id: string | null;
}

export interface TensionListResponse {
  tensions: TensionEntry[];
  subjects: string[];
  totals: {
    tension_count: number;
    official_count: number;
    observed_count: number;
  };
  catalog_ready: boolean;
}

export interface TensionExampleRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  question_stem: string | null;
}

export interface TensionSubjectRow {
  subject: string;
  question_count: number | string;
}

export interface TensionExample {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  stem_preview: string | null;
}

export interface TensionSubjectCount {
  subject: string;
  question_count: number;
}

export interface TensionDetailResponse {
  slug: string;
  name: string;
  official: boolean;
  tension_point_id: string | null;
  subject: string | null;
  domain: string | null;
  legal_collision: string | null;
  decision_axis: string | null;
  common_misconceptions: string | null;
  question_count: number;
  subject_distribution: TensionSubjectCount[];
  examples: TensionExample[];
  examples_truncated: boolean;
  catalog_ready: boolean;
}

export interface TensionQuestionRow {
  question_id: string;
  external_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  tension_point: string | null;
}

export interface TensionQuestionsResponse {
  slug: string;
  page: number;
  limit: number;
  total: number;
  questions: TensionQuestionRow[];
}

// ---- shapers ----

const STEM_PREVIEW_MAX = 240;

function preview(text: string | null): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= STEM_PREVIEW_MAX) return normalized;
  return `${normalized.slice(0, STEM_PREVIEW_MAX - 1)}…`;
}

/**
 * Merge the curated catalog (rich, "official") with observed-in-bank tension tags
 * ("observed"). Pass catalogRows = null when the catalog table is unprovisioned;
 * the response then carries catalog_ready=false and lists observed tags only.
 */
export function shapeTensionList(
  catalogRows: TensionCatalogRow[] | null,
  observedRows: TensionObservedRow[],
): TensionListResponse {
  const observed = new Map<string, { count: number; subject: string | null }>();
  for (const r of observedRows) {
    if (!r.tension_value) continue;
    observed.set(r.tension_value, {
      count: Number(r.question_count) || 0,
      subject: r.subject ?? null,
    });
  }

  const tensions: TensionEntry[] = [];
  const consumed = new Set<string>();

  if (catalogRows) {
    for (const c of catalogRows) {
      // The bank tags by tension_point_id (canonical); some seeds tag by slug.
      const byId = observed.get(c.tension_point_id);
      const bySlug = c.slug !== c.tension_point_id ? observed.get(c.slug) : undefined;
      const count = byId?.count ?? bySlug?.count ?? 0;
      if (byId) consumed.add(c.tension_point_id);
      if (bySlug) consumed.add(c.slug);
      tensions.push({
        slug: c.slug,
        name: c.tension_name,
        subject: c.subject,
        domain: c.domain,
        official: true,
        question_count: count,
        tension_point_id: c.tension_point_id,
      });
    }
  }

  for (const [value, info] of observed) {
    if (consumed.has(value)) continue;
    tensions.push({
      slug: value,
      name: humanizeTensionSlug(value),
      subject: info.subject ?? "Uncategorized",
      domain: null,
      official: false,
      question_count: info.count,
      tension_point_id: null,
    });
  }

  tensions.sort(
    (a, b) =>
      a.subject.localeCompare(b.subject) ||
      Number(b.official) - Number(a.official) ||
      b.question_count - a.question_count ||
      a.name.localeCompare(b.name),
  );

  const subjects = [...new Set(tensions.map((t) => t.subject))].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    tensions,
    subjects,
    totals: {
      tension_count: tensions.length,
      official_count: tensions.filter((t) => t.official).length,
      observed_count: tensions.filter((t) => !t.official).length,
    },
    catalog_ready: catalogRows !== null,
  };
}

export function shapeTensionDetail(
  slug: string,
  catalogRow: TensionCatalogRow | null,
  catalogReady: boolean,
  exampleRows: TensionExampleRow[],
  subjectRows: TensionSubjectRow[],
  examplesLimit: number = DEFAULT_EXAMPLES_LIMIT,
): TensionDetailResponse {
  const examples: TensionExample[] = exampleRows.map((row) => ({
    question_id: row.question_id,
    external_id: row.external_id,
    subject: row.subject,
    topic: row.topic,
    subtopic: row.subtopic,
    stem_preview: preview(row.question_stem),
  }));

  const subject_distribution: TensionSubjectCount[] = subjectRows.map((row) => ({
    subject: row.subject,
    question_count: Number(row.question_count) || 0,
  }));

  // A question carries exactly one subject, so distinct-question counts summed
  // across subjects equal the tension's total distinct-question count.
  const question_count = subject_distribution.reduce(
    (sum, row) => sum + row.question_count,
    0,
  );

  return {
    slug: catalogRow?.slug ?? slug,
    name: catalogRow?.tension_name ?? humanizeTensionSlug(slug),
    official: catalogRow !== null,
    tension_point_id: catalogRow?.tension_point_id ?? null,
    subject: catalogRow?.subject ?? subject_distribution[0]?.subject ?? null,
    domain: catalogRow?.domain ?? null,
    legal_collision: catalogRow?.legal_collision ?? null,
    decision_axis: catalogRow?.decision_axis ?? null,
    common_misconceptions: catalogRow?.common_misconceptions ?? null,
    question_count,
    subject_distribution,
    examples,
    examples_truncated: examples.length >= examplesLimit,
    catalog_ready: catalogReady,
  };
}

export function shapeTensionQuestions(
  slug: string,
  page: number,
  limit: number,
  total: number,
  rows: TensionQuestionRow[],
): TensionQuestionsResponse {
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
