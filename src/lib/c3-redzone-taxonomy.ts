import { readFileSync } from "node:fs";

import type {
  C3ChoicePattern,
  C3ComponentPayload,
  C3PacketSummary,
  C3RedZoneCategory,
  C3TaxonomyAxis,
  C3TaxonomyData,
} from "../scripts/generate-c3-redzone-taxonomy.js";

const DATA_URL = new URL("../data/c3-redzone-taxonomy.json", import.meta.url);
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

let cachedData: C3TaxonomyData | null = null;

export interface C3ListQuery {
  red_zone_id?: string | null;
  subject?: string | null;
  outline_code?: string | null;
  mold_code?: string | null;
  filter_broken?: string | null;
  limit?: number | null;
}

export interface C3RedZoneCatalogEntry extends C3RedZoneCategory {
  axis_count: number;
  choice_pattern_count: number;
  packet_count: number;
  subjects: string[];
}

export function loadC3RedZoneTaxonomy(): C3TaxonomyData {
  cachedData ??= JSON.parse(readFileSync(DATA_URL, "utf8")) as C3TaxonomyData;
  return cachedData;
}

export function clampLimit(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)));
}

export function readQueryString(value: unknown): string | null {
  const text =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? String(value[0] ?? "")
        : "";
  const trimmed = text.trim();
  return trimmed || null;
}

export function buildC3RedZoneCatalog(data = loadC3RedZoneTaxonomy()): {
  version: string;
  categories: C3RedZoneCatalogEntry[];
  totals: C3TaxonomyData["totals"];
} {
  const visibleAxes = data.axes.filter((axis) => axis.visible);
  const visiblePatterns = data.choice_patterns.filter((pattern) => pattern.visible);
  return {
    version: data.version,
    totals: data.totals,
    categories: data.categories.map((category) => {
      const axes = visibleAxes.filter((axis) => axis.red_zone_id === category.red_zone_id);
      const packets = new Set(axes.map((axis) => axis.outline_code));
      return {
        ...category,
        axis_count: axes.length,
        choice_pattern_count: visiblePatterns.filter(
          (pattern) => pattern.red_zone_id === category.red_zone_id,
        ).length,
        packet_count: packets.size,
        subjects: [...new Set(axes.map((axis) => axis.subject))].sort(),
      };
    }),
  };
}

export function listC3Axes(query: C3ListQuery = {}, data = loadC3RedZoneTaxonomy()): {
  axes: C3TaxonomyAxis[];
  total: number;
  returned: number;
} {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const axes = data.axes
    .filter((axis) => axis.visible)
    .filter((axis) => !query.red_zone_id || axis.red_zone_id === query.red_zone_id)
    .filter((axis) => !query.subject || axis.subject.toLowerCase() === query.subject.toLowerCase())
    .filter((axis) => !query.outline_code || axis.outline_code === query.outline_code)
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.outline_code.localeCompare(b.outline_code));
  return { axes: axes.slice(0, limit), total: axes.length, returned: Math.min(limit, axes.length) };
}

export function getC3Axis(axisId: string, data = loadC3RedZoneTaxonomy()): {
  axis: C3TaxonomyAxis;
  choice_patterns: C3ChoicePattern[];
} | null {
  const axis = data.axes.find((row) => row.visible && row.axis_id === axisId);
  if (!axis) return null;
  return {
    axis,
    choice_patterns: data.choice_patterns.filter((pattern) => pattern.visible && pattern.axis_id === axisId),
  };
}

export function listC3ChoicePatterns(
  query: C3ListQuery = {},
  data = loadC3RedZoneTaxonomy(),
): {
  choice_patterns: C3ChoicePattern[];
  total: number;
  returned: number;
} {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const patterns = data.choice_patterns
    .filter((pattern) => pattern.visible)
    .filter((pattern) => !query.red_zone_id || pattern.red_zone_id === query.red_zone_id)
    .filter((pattern) => !query.subject || pattern.subject.toLowerCase() === query.subject.toLowerCase())
    .filter((pattern) => !query.outline_code || pattern.outline_code === query.outline_code)
    .filter((pattern) => !query.mold_code || pattern.mold_code === query.mold_code)
    .filter((pattern) => !query.filter_broken || pattern.filter_broken === query.filter_broken)
    .sort((a, b) => a.mold_code.localeCompare(b.mold_code) || a.outline_code.localeCompare(b.outline_code));
  return {
    choice_patterns: patterns.slice(0, limit),
    total: patterns.length,
    returned: Math.min(limit, patterns.length),
  };
}

export function getC3ChoicePattern(patternId: string, data = loadC3RedZoneTaxonomy()): {
  choice_pattern: C3ChoicePattern;
  axis: C3TaxonomyAxis | null;
} | null {
  const choicePattern = data.choice_patterns.find((row) => row.visible && row.choice_pattern_id === patternId);
  if (!choicePattern) return null;
  return {
    choice_pattern: choicePattern,
    axis: data.axes.find((axis) => axis.visible && axis.axis_id === choicePattern.axis_id) ?? null,
  };
}

export function getC3OutlineComponents(outlineCode: string, data = loadC3RedZoneTaxonomy()): {
  packet: C3PacketSummary;
  axes: C3TaxonomyAxis[];
  choice_patterns: C3ChoicePattern[];
  component_payloads: C3ComponentPayload[];
} | null {
  const packet = data.packets.find((row) => row.visible && row.outline_code === outlineCode);
  if (!packet) return null;
  return {
    packet,
    axes: data.axes.filter((axis) => axis.visible && axis.outline_code === outlineCode),
    choice_patterns: data.choice_patterns.filter(
      (pattern) => pattern.visible && pattern.outline_code === outlineCode,
    ),
    component_payloads: data.component_payloads.filter(
      (payload) => payload.visible && payload.outline_code === outlineCode,
    ),
  };
}
