export const KNOWLEDGE_COMPONENTS = [
  "01-tension-map",
  "02-trap-taxonomy",
  "03-question-bank",
  "04-drill-library",
  "05-boot-camp",
] as const;

export type KnowledgeComponent = (typeof KNOWLEDGE_COMPONENTS)[number];

const COMPONENT_ALIASES: Record<string, KnowledgeComponent> = {
  "01": "01-tension-map",
  "1": "01-tension-map",
  tension: "01-tension-map",
  "tension-map": "01-tension-map",
  tension_map: "01-tension-map",
  "01-tension-map": "01-tension-map",

  "02": "02-trap-taxonomy",
  "2": "02-trap-taxonomy",
  trap: "02-trap-taxonomy",
  traps: "02-trap-taxonomy",
  "trap-taxonomy": "02-trap-taxonomy",
  trap_taxonomy: "02-trap-taxonomy",
  "02-trap-taxonomy": "02-trap-taxonomy",

  "03": "03-question-bank",
  "3": "03-question-bank",
  questions: "03-question-bank",
  "question-bank": "03-question-bank",
  question_bank: "03-question-bank",
  "03-question-bank": "03-question-bank",

  "04": "04-drill-library",
  "4": "04-drill-library",
  drills: "04-drill-library",
  "drill-library": "04-drill-library",
  drill_library: "04-drill-library",
  "04-drill-library": "04-drill-library",

  "05": "05-boot-camp",
  "5": "05-boot-camp",
  bootcamp: "05-boot-camp",
  "boot-camp": "05-boot-camp",
  boot_camp: "05-boot-camp",
  "05-boot-camp": "05-boot-camp",
};

const CHANNELS = new Set(["channel1", "channel2", "bridge", "product_surface"]);
const CANONICALITIES = new Set(["canonical", "candidate", "rejected", "reference_only"]);
const REVIEW_STATUSES = new Set([
  "needs_review",
  "content_review",
  "content_approved",
  "attorney_review",
  "attorney_approved",
  "rejected",
]);
const PROMOTION_STATUSES = new Set(["hold", "queued", "promoted", "rejected", "archived"]);

export class KnowledgeSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeSearchInputError";
  }
}

export interface KnowledgeSearchFilters {
  q?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  component?: KnowledgeComponent;
  channel?: string;
  objectType?: string;
  canonicality?: string;
  reviewStatus?: string;
  promotionStatus?: string;
  sourceId?: string;
  includeRejected: boolean;
  limit: number;
}

export interface KnowledgeSearchQuery {
  sql: string;
  values: unknown[];
}

export interface KnowledgeRow {
  object_id: string;
  object_type: string;
  source_id: string;
  source_role: string;
  source_path: string | null;
  source_span_start: number | null;
  source_span_end: number | null;
  canonicality: string;
  review_status: string;
  promotion_status: string;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  taxonomy_version: string | null;
  taxonomy_ids: unknown;
  channel: string;
  component_targets: unknown;
  wrong_answer_tags: unknown;
  channel2_architecture: string | null;
  surface_pattern: string | null;
  decoder_move: string | null;
  summary: string | null;
  body: string;
  metadata: unknown;
  text_score: number | string;
}

export interface KnowledgeSearchResult {
  object_id: string;
  object_type: string;
  summary: string | null;
  body_preview: string;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  taxonomy_version: string | null;
  taxonomy_ids: Record<string, unknown>;
  channel: string;
  component_targets: string[];
  wrong_answer_tags: string[];
  channel2_architecture: string | null;
  surface_pattern: string | null;
  decoder_move: string | null;
  metadata: Record<string, unknown>;
  text_score: number;
  source: {
    source_id: string;
    source_role: string;
    source_path: string | null;
    source_span_start: number | null;
    source_span_end: number | null;
  };
  review: {
    canonicality: string;
    review_status: string;
    promotion_status: string;
  };
}

export interface KnowledgeSearchResponse {
  filters: KnowledgeSearchFilters;
  results: KnowledgeSearchResult[];
  by_component: Record<string, string[]>;
  review_summary: Record<string, number>;
}

export function normalizeKnowledgeSearch(raw: Record<string, unknown>): KnowledgeSearchFilters {
  const component = normalizeComponent(readString(raw.component));
  const channel = normalizeChoice(readString(raw.channel), CHANNELS, "channel");
  const canonicality = normalizeChoice(readString(raw.canonicality), CANONICALITIES, "canonicality");
  const reviewStatus = normalizeChoice(readString(raw.review_status), REVIEW_STATUSES, "review_status");
  const promotionStatus = normalizeChoice(
    readString(raw.promotion_status),
    PROMOTION_STATUSES,
    "promotion_status",
  );

  return {
    q: normalizeText(readString(raw.q), 500),
    subject: normalizeText(readString(raw.subject), 64),
    topic: normalizeText(readString(raw.topic), 128),
    subtopic: normalizeText(readString(raw.subtopic), 128),
    component,
    channel,
    objectType: normalizeToken(readString(raw.object_type), "object_type"),
    canonicality,
    reviewStatus,
    promotionStatus,
    sourceId: normalizeToken(readString(raw.source_id), "source_id"),
    includeRejected: readBoolean(raw.include_rejected),
    limit: normalizeLimit(readString(raw.limit)),
  };
}

export function buildKnowledgeSearchQuery(filters: KnowledgeSearchFilters): KnowledgeSearchQuery {
  const values: unknown[] = [];
  const next = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  let textScore = "0";
  let textParam: string | null = null;
  if (filters.q) {
    textParam = next(filters.q);
    textScore = `MATCH(ko.summary, ko.body) AGAINST (${textParam} IN NATURAL LANGUAGE MODE)`;
  }

  const where = ["1 = 1"];
  if (!filters.includeRejected) {
    where.push("ko.review_status <> 'rejected'");
    where.push("ko.promotion_status NOT IN ('rejected', 'archived')");
  }
  if (filters.q && textParam) {
    const textLikeParam = `CAST(${textParam} AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci`;
    const escapedLikeParam = next(escapeLike(filters.q));
    where.push(
      `(${textScore} > 0 OR ko.object_id = ${textLikeParam} OR ko.summary LIKE CONCAT('%', ${escapedLikeParam}, '%') ESCAPE '\\\\' OR ko.body LIKE CONCAT('%', ${escapedLikeParam}, '%') ESCAPE '\\\\')`,
    );
  }
  if (filters.subject) where.push(`ko.subject = ${next(filters.subject)}`);
  if (filters.topic) where.push(`ko.topic = ${next(filters.topic)}`);
  if (filters.subtopic) where.push(`ko.subtopic = ${next(filters.subtopic)}`);
  if (filters.component) {
    where.push(`JSON_CONTAINS(ko.component_targets, JSON_QUOTE(${next(filters.component)}))`);
  }
  if (filters.channel) where.push(`ko.channel = ${next(filters.channel)}`);
  if (filters.objectType) where.push(`ko.object_type = ${next(filters.objectType)}`);
  if (filters.canonicality) where.push(`ko.canonicality = ${next(filters.canonicality)}`);
  if (filters.reviewStatus) where.push(`ko.review_status = ${next(filters.reviewStatus)}`);
  if (filters.promotionStatus) where.push(`ko.promotion_status = ${next(filters.promotionStatus)}`);
  if (filters.sourceId) where.push(`ko.source_id = ${next(filters.sourceId)}`);

  const limitParam = next(filters.limit);
  return {
    sql: `
      SELECT
        ko.object_id,
        ko.object_type,
        ko.source_id,
        ko.source_role,
        ko.source_path,
        ko.source_span_start,
        ko.source_span_end,
        ko.canonicality,
        ko.review_status,
        ko.promotion_status,
        ko.subject,
        ko.topic,
        ko.subtopic,
        ko.taxonomy_version,
        ko.taxonomy_ids,
        ko.channel,
        ko.component_targets,
        ko.wrong_answer_tags,
        ko.channel2_architecture,
        ko.surface_pattern,
        ko.decoder_move,
        ko.summary,
        ko.body,
        ko.metadata,
        ${textScore} AS text_score
      FROM knowledge_objects ko
      WHERE ${where.join("\n        AND ")}
      ORDER BY
        text_score DESC,
        CASE ko.review_status
          WHEN 'attorney_approved' THEN 0
          WHEN 'content_approved' THEN 1
          WHEN 'attorney_review' THEN 2
          WHEN 'content_review' THEN 3
          WHEN 'needs_review' THEN 4
          ELSE 5
        END ASC,
        ko.source_id ASC,
        ko.object_id ASC
      LIMIT ${limitParam}
    `,
    values,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function shapeKnowledgeSearchResponse(
  filters: KnowledgeSearchFilters,
  rows: KnowledgeRow[],
): KnowledgeSearchResponse {
  const byComponent: Record<string, string[]> = {};
  const reviewSummary: Record<string, number> = {};
  const results = rows.map((row) => {
    const componentTargets = parseJsonArray(row.component_targets);
    const reviewKey = `${row.canonicality}/${row.review_status}/${row.promotion_status}`;
    reviewSummary[reviewKey] = (reviewSummary[reviewKey] ?? 0) + 1;
    for (const component of componentTargets) {
      const list = byComponent[component] ?? [];
      list.push(row.object_id);
      byComponent[component] = list;
    }

    return {
      object_id: row.object_id,
      object_type: row.object_type,
      summary: row.summary,
      body_preview: preview(row.body),
      subject: row.subject,
      topic: row.topic,
      subtopic: row.subtopic,
      taxonomy_version: row.taxonomy_version,
      taxonomy_ids: parseJsonObject(row.taxonomy_ids),
      channel: row.channel,
      component_targets: componentTargets,
      wrong_answer_tags: parseJsonArray(row.wrong_answer_tags),
      channel2_architecture: row.channel2_architecture,
      surface_pattern: row.surface_pattern,
      decoder_move: row.decoder_move,
      metadata: parseJsonObject(row.metadata),
      text_score: Number(row.text_score) || 0,
      source: {
        source_id: row.source_id,
        source_role: row.source_role,
        source_path: row.source_path,
        source_span_start: row.source_span_start,
        source_span_end: row.source_span_end,
      },
      review: {
        canonicality: row.canonicality,
        review_status: row.review_status,
        promotion_status: row.promotion_status,
      },
    };
  });

  return {
    filters,
    results,
    by_component: byComponent,
    review_summary: reviewSummary,
  };
}

function readString(value: unknown): string | undefined {
  if (Array.isArray(value)) return readString(value[0]);
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return String(value);
}

function readBoolean(value: unknown): boolean {
  const text = readString(value)?.trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function normalizeText(value: string | undefined, maxLength: number): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
}

function normalizeToken(value: string | undefined, field: string): string | undefined {
  const text = normalizeText(value, 128);
  if (!text) return undefined;
  if (!/^[A-Za-z0-9_.:-]+$/.test(text)) {
    throw new KnowledgeSearchInputError(`invalid ${field}`);
  }
  return text;
}

function normalizeChoice(
  value: string | undefined,
  allowed: Set<string>,
  field: string,
): string | undefined {
  const text = normalizeText(value, 128);
  if (!text) return undefined;
  if (!allowed.has(text)) throw new KnowledgeSearchInputError(`invalid ${field}`);
  return text;
}

function normalizeComponent(value: string | undefined): KnowledgeComponent | undefined {
  const text = value?.trim().toLowerCase();
  if (!text) return undefined;
  const component = COMPONENT_ALIASES[text];
  if (!component) throw new KnowledgeSearchInputError("invalid component");
  return component;
}

function normalizeLimit(value: string | undefined): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(parsed)));
}

function parseJsonArray(value: unknown): string[] {
  const parsed = parseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value, {});
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function parseJson<T>(value: unknown, fallback: T): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function preview(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 500) return normalized;
  return `${normalized.slice(0, 497)}...`;
}
