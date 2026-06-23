import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const DEFAULT_SOURCE_DIR = "C:/AAABM/finished";
const DEFAULT_OUT_FILE = "C:/barmatrix-api/src/data/c3-redzone-taxonomy.json";
const RED_ZONE_IDS = new Set([
  "RZ-01",
  "RZ-02",
  "RZ-03",
  "RZ-04",
  "RZ-05",
  "RZ-06",
  "RZ-07",
  "RZ-08",
  "RZ-09",
  "RZ-10",
]);

type JsonRecord = Record<string, unknown>;

export interface C3RedZoneCategory {
  red_zone_id: string;
  locked_title: string;
  grid_label: string;
  short_label: string;
  display_order: number;
  core_idea: string;
  student_question: string;
  student_move: string;
  failure_signature: string;
  mantra: string;
}

export interface C3TaxonomyAxis {
  axis_id: string;
  outline_code: string;
  axis_name: string;
  red_zone_id: string;
  subject: string;
  subtopic: string | null;
  node_title: string | null;
  side_a: string | null;
  side_b: string | null;
  resolver_type: string | null;
  resolver: string | null;
  c3_phase: string | null;
  method_class: string | null;
  merge_guard: string | null;
  qa_score_12: number | null;
  visible: boolean;
  source_file: string;
  packet_id: string | null;
}

export interface C3ChoicePattern {
  choice_pattern_id: string;
  axis_id: string;
  outline_code: string;
  red_zone_id: string;
  subject: string;
  filter_broken: string;
  mold_code: string;
  bait_architecture_code: string | null;
  wrong_answer_form: string | null;
  why_it_attracts_students: string | null;
  student_visible_signal: string | null;
  true_responsive_repair: string | null;
  method_class: string | null;
  qa_score_12: number | null;
  visible: boolean;
  source_file: string;
  packet_id: string | null;
}

export interface C3PacketSummary {
  outline_code: string;
  source_file: string;
  packet_id: string | null;
  packet_verdict: string | null;
  subject: string;
  subject_display: string | null;
  subtopic: string | null;
  node_title: string | null;
  red_zone_ids: string[];
  component_targets: string[];
  axis_count: number;
  choice_pattern_count: number;
  human_review_count: number;
  visible: boolean;
  warnings: string[];
}

export interface C3ComponentPayload {
  outline_code: string;
  component_target: string;
  status: string;
  axis_ids: string[];
  choice_pattern_ids: string[];
  visible: boolean;
}

export interface C3TaxonomyData {
  version: "c3-redzone-v5";
  generated_at: string;
  source_dir: string;
  source_hash: string;
  categories: C3RedZoneCategory[];
  packets: C3PacketSummary[];
  axes: C3TaxonomyAxis[];
  choice_patterns: C3ChoicePattern[];
  component_payloads: C3ComponentPayload[];
  human_review_rows: JsonRecord[];
  totals: {
    files: number;
    packets: number;
    visible_packets: number;
    blocked_packets: number;
    axes: number;
    visible_axes: number;
    choice_patterns: number;
    visible_choice_patterns: number;
    human_review_rows: number;
  };
}

export const LOCKED_RED_ZONE_CATEGORIES: C3RedZoneCategory[] = [
  {
    red_zone_id: "RZ-01",
    locked_title: "Permission Before Action",
    grid_label: "Permission",
    short_label: "Can we use it yet?",
    display_order: 1,
    core_idea: "The answer acts before the legal gate opens.",
    student_question: "Can this move happen yet?",
    student_move: "Check authority, admissibility, standing, or procedural permission first.",
    failure_signature: "The tempting answer skips the threshold gate.",
    mantra: "Permission before action.",
  },
  {
    red_zone_id: "RZ-02",
    locked_title: "Kind Before Consequence",
    grid_label: "Kind",
    short_label: "Name the thing first.",
    display_order: 2,
    core_idea: "The answer assigns a consequence before classifying the legal thing.",
    student_question: "What kind of thing is this?",
    student_move: "Classify the claim, right, status, estate, or interest before applying results.",
    failure_signature: "The tempting answer jumps from facts to remedy or result.",
    mantra: "Kind before consequence.",
  },
  {
    red_zone_id: "RZ-03",
    locked_title: "Frame Before Logic",
    grid_label: "Frame",
    short_label: "Which world are we in?",
    display_order: 3,
    core_idea: "The answer uses the wrong legal frame for otherwise familiar facts.",
    student_question: "Which legal frame controls?",
    student_move: "Set the procedural, evidentiary, constitutional, or doctrinal lane first.",
    failure_signature: "The tempting answer is plausible in a neighboring frame.",
    mantra: "Frame before logic.",
  },
  {
    red_zone_id: "RZ-04",
    locked_title: "Order Before Outcome",
    grid_label: "Order",
    short_label: "Fix the clock.",
    display_order: 4,
    core_idea: "The answer gets events, priorities, or procedural steps out of order.",
    student_question: "What happened first?",
    student_move: "Put the chain in order before deciding who wins.",
    failure_signature: "The tempting answer reverses timing, priority, or sequence.",
    mantra: "Order before outcome.",
  },
  {
    red_zone_id: "RZ-05",
    locked_title: "Use Before Meaning",
    grid_label: "Use",
    short_label: "Used for what?",
    display_order: 5,
    core_idea: "The answer treats legal meaning as fixed before asking the use or purpose.",
    student_question: "What is this being used for?",
    student_move: "Tie the evidence, statement, writing, or fact to the exact legal use.",
    failure_signature: "The tempting answer ignores purpose or offered use.",
    mantra: "Use before meaning.",
  },
  {
    red_zone_id: "RZ-06",
    locked_title: "Boundary Before Reach",
    grid_label: "Boundary",
    short_label: "Where is the edge?",
    display_order: 6,
    core_idea: "The answer extends a rule beyond its boundary.",
    student_question: "Where does this rule stop?",
    student_move: "Find the edge, exception, scope limit, or jurisdictional boundary.",
    failure_signature: "The tempting answer overreaches from a true rule.",
    mantra: "Boundary before reach.",
  },
  {
    red_zone_id: "RZ-07",
    locked_title: "Link Before Story",
    grid_label: "Link",
    short_label: "Find the missing link.",
    display_order: 7,
    core_idea: "The answer tells a coherent story without the required legal link.",
    student_question: "What connects these facts to the result?",
    student_move: "Identify causation, intent, notice, reliance, or another required connector.",
    failure_signature: "The tempting answer is narratively satisfying but legally unlinked.",
    mantra: "Link before story.",
  },
  {
    red_zone_id: "RZ-08",
    locked_title: "Scale Before Switch",
    grid_label: "Scale",
    short_label: "Dial, not toggle.",
    display_order: 8,
    core_idea: "The answer turns a degree judgment into an all-or-nothing switch.",
    student_question: "Is this a dial or a toggle?",
    student_move: "Restore the degree word: reasonable, substantial, material, unfair, enough.",
    failure_signature: "The tempting answer uses absolute wording for a scaled standard.",
    mantra: "Scale before switch.",
  },
  {
    red_zone_id: "RZ-09",
    locked_title: "Event Is Not Effect",
    grid_label: "Event/Effect",
    short_label: "What happened is not what follows.",
    display_order: 9,
    core_idea: "The answer treats an event as automatically producing the legal effect.",
    student_question: "What follows from that event?",
    student_move: "Separate occurrence from consequence, remedy, admissibility, or preservation.",
    failure_signature: "The tempting answer makes the event do too much work.",
    mantra: "Event is not effect.",
  },
  {
    red_zone_id: "RZ-10",
    locked_title: "Residual Signal",
    grid_label: "Residual",
    short_label: "Hold, don't harden.",
    display_order: 10,
    core_idea: "The signal is real but not yet stable enough to force a category.",
    student_question: "Is this a signal or a settled rule?",
    student_move: "Hold the uncertainty and avoid hardening a weak cue into a conclusion.",
    failure_signature: "The tempting answer overcommits on an incomplete signal.",
    mantra: "Hold the signal.",
  },
];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function str(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractFence(markdown: string, heading: string, language: string): string {
  const headingIndex = markdown.search(new RegExp(`^##\\s+${heading}\\s*$`, "m"));
  if (headingIndex < 0) throw new Error(`missing ## ${heading}`);
  const after = markdown.slice(headingIndex);
  const fence = after.match(new RegExp("```" + language + "\\s*\\r?\\n([\\s\\S]*?)\\r?\\n```", "i"));
  if (!fence?.[1]) throw new Error(`missing ${language} fence after ${heading}`);
  return fence[1];
}

function extractInitialYaml(markdown: string): JsonRecord {
  const fence = markdown.match(/^```yaml\s*\r?\n([\s\S]*?)\r?\n```/i);
  if (!fence?.[1]) throw new Error("missing opening yaml packet block");
  return asRecord(parseYaml(fence[1]));
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function qaScore(row: JsonRecord): number | null {
  return num(asRecord(row.qa).score_12) ?? num(row.qa_score_12);
}

function componentTargets(bridge: JsonRecord, ingestion: JsonRecord): C3ComponentPayload[] {
  const rows: C3ComponentPayload[] = [];
  const payloads = asRecord(bridge.component_payloads);
  for (const [target, value] of Object.entries(payloads)) {
    const record = asRecord(value);
    rows.push({
      outline_code: "",
      component_target: target,
      status: str(record.status) ?? str(value) ?? "unknown",
      axis_ids: Array.isArray(record.axis_ids) ? record.axis_ids.map(str).filter(Boolean) as string[] : [],
      choice_pattern_ids: Array.isArray(record.choice_pattern_ids)
        ? record.choice_pattern_ids.map(str).filter(Boolean) as string[]
        : [],
      visible: false,
    });
  }
  for (const row of asArray(ingestion.component_payload_rows)) {
    const target = str(row.component_target) ?? str(row.component);
    if (!target || rows.some((item) => item.component_target === target)) continue;
    rows.push({
      outline_code: "",
      component_target: target,
      status: str(row.status) ?? "unknown",
      axis_ids: unique([str(row.axis_id)]),
      choice_pattern_ids: unique([str(row.choice_pattern_id)]),
      visible: false,
    });
  }
  return rows;
}

function sourceHash(rows: C3PacketSummary[]): string {
  return createHash("sha256")
    .update(rows.map((row) => `${row.source_file}:${row.packet_id}:${row.axis_count}:${row.choice_pattern_count}`).join("\n"))
    .digest("hex");
}

export function buildC3RedZoneTaxonomy(sourceDir: string): C3TaxonomyData {
  const files = existsSync(sourceDir)
    ? readdirSync(sourceDir).filter((name) => name.toLowerCase().endsWith(".md")).sort()
    : [];
  const packets: C3PacketSummary[] = [];
  const axes: C3TaxonomyAxis[] = [];
  const choicePatterns: C3ChoicePattern[] = [];
  const payloadRows: C3ComponentPayload[] = [];
  const humanReviewRows: JsonRecord[] = [];

  for (const file of files) {
    const markdown = readFileSync(path.join(sourceDir, file), "utf8");
    const yaml = extractInitialYaml(markdown);
    const bridge = asRecord(JSON.parse(extractFence(markdown, "component_bridge_json", "json")));
    const ingestion = asRecord(JSON.parse(extractFence(markdown, "ingestion_rows_json", "json")));
    const packet = asRecord(yaml.packet);
    const metadata = asRecord(packet.packet_metadata);
    const target = asRecord(packet.target_input_echo);
    const scope = asRecord(packet.node_scope_summary);
    const outlineCode = str(bridge.outline_code) ?? str(target.outline_code) ?? path.basename(file, ".md");
    const packetId = str(metadata.packet_id) ?? str(asRecord(bridge.import_manifest).source_prompt_id);
    const quality = asRecord(packet.quality_control);
    const contentReviewStatus = str(metadata.content_review_status);
    const packetVerdict =
      str(metadata.packet_verdict) ??
      str(packet.packet_verdict) ??
      str(quality.packet_verdict) ??
      str(asRecord(bridge.import_manifest).packet_verdict) ??
      (contentReviewStatus === "ready_for_ingestion" ? "READY" : null);
    const subject = str(target.subject_enum) ?? str(target.subject) ?? "UNKNOWN";
    const subtopic = str(target.subtopic);
    const nodeTitle = str(scope.node_title) ?? str(target.node_title);
    const yamlAxes = asArray(packet.canonical_axes);
    const yamlPatterns = asArray(packet.axis_choice_patterns);
    const ingestAxes = asArray(ingestion.canonical_axes);
    const ingestPatterns = asArray(ingestion.axis_choice_patterns);
    const rawAxes = yamlAxes.length > 0 ? yamlAxes : ingestAxes;
    const rawPatterns = yamlPatterns.length > 0 ? yamlPatterns : ingestPatterns;
    const reviewRows = asArray(ingestion.human_review_rows);
    const warnings: string[] = [];
    if (!/^[0-9]{8}$/.test(outlineCode)) warnings.push(`invalid outline_code ${outlineCode}`);
    const packetBlocked = reviewRows.length > 0 || packetVerdict !== "READY";

    for (const row of reviewRows) {
      humanReviewRows.push({ ...row, outline_code: outlineCode, source_file: file, packet_id: packetId });
    }

    const axisById = new Map<string, C3TaxonomyAxis>();
    for (const row of rawAxes) {
      const axisId = str(row.axis_id);
      const redZoneId = str(row.red_zone_id);
      const axisName = str(row.axis_name);
      const required = Boolean(axisId && axisName && redZoneId && RED_ZONE_IDS.has(redZoneId));
      if (!required) warnings.push(`axis ${axisId ?? "(missing)"} missing required taxonomy fields`);
      if (!axisId || !redZoneId) continue;
      const axis: C3TaxonomyAxis = {
        axis_id: axisId,
        outline_code: str(row.outline_code) ?? outlineCode,
        axis_name: axisName ?? axisId,
        red_zone_id: redZoneId,
        subject,
        subtopic,
        node_title: nodeTitle,
        side_a: str(row.side_a),
        side_b: str(row.side_b),
        resolver_type: str(row.resolver_type),
        resolver: str(row.resolver),
        c3_phase: str(row.c3_phase),
        method_class: str(row.method_class),
        merge_guard: str(row.merge_guard),
        qa_score_12: qaScore(row),
        visible: required && !packetBlocked,
        source_file: file,
        packet_id: packetId,
      };
      axisById.set(axisId, axis);
      axes.push(axis);
    }

    for (const row of rawPatterns) {
      const patternId = str(row.choice_pattern_id);
      const axisId = str(row.axis_id);
      const parentAxis = axisId ? axisById.get(axisId) : undefined;
      const redZoneId = str(row.red_zone_id) ?? parentAxis?.red_zone_id ?? null;
      const filterBroken = str(row.filter_broken);
      const moldCode = str(row.mold_code);
      const required = Boolean(patternId && axisId && filterBroken && moldCode && redZoneId && RED_ZONE_IDS.has(redZoneId));
      if (!required) warnings.push(`choice pattern ${patternId ?? "(missing)"} missing required taxonomy fields`);
      if (!patternId || !axisId || !redZoneId || !filterBroken || !moldCode) continue;
      choicePatterns.push({
        choice_pattern_id: patternId,
        axis_id: axisId,
        outline_code: str(row.outline_code) ?? outlineCode,
        red_zone_id: redZoneId,
        subject,
        filter_broken: filterBroken,
        mold_code: moldCode,
        bait_architecture_code: str(row.bait_architecture_code),
        wrong_answer_form: str(row.wrong_answer_form),
        why_it_attracts_students: str(row.why_it_attracts_students),
        student_visible_signal: str(row.student_visible_signal),
        true_responsive_repair: str(row.true_responsive_repair),
        method_class: str(row.method_class),
        qa_score_12: qaScore(row),
        visible: required && !packetBlocked,
        source_file: file,
        packet_id: packetId,
      });
    }

    const redZoneIds = unique(rawAxes.map((row) => str(row.red_zone_id)));
    const components = componentTargets(bridge, ingestion).map((row) => ({
      ...row,
      outline_code: outlineCode,
      visible: row.status === "ready" && !packetBlocked,
    }));
    payloadRows.push(...components);
    packets.push({
      outline_code: outlineCode,
      source_file: file,
      packet_id: packetId,
      packet_verdict: packetVerdict,
      subject,
      subject_display: str(target.subject_display),
      subtopic,
      node_title: nodeTitle,
      red_zone_ids: redZoneIds,
      component_targets: components.map((row) => row.component_target).sort(),
      axis_count: rawAxes.length,
      choice_pattern_count: rawPatterns.length,
      human_review_count: reviewRows.length,
      visible: !packetBlocked && warnings.length === 0,
      warnings,
    });
  }

  return {
    version: "c3-redzone-v5",
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    source_hash: sourceHash(packets),
    categories: LOCKED_RED_ZONE_CATEGORIES,
    packets,
    axes,
    choice_patterns: choicePatterns,
    component_payloads: payloadRows,
    human_review_rows: humanReviewRows,
    totals: {
      files: files.length,
      packets: packets.length,
      visible_packets: packets.filter((packet) => packet.visible).length,
      blocked_packets: packets.filter((packet) => !packet.visible).length,
      axes: axes.length,
      visible_axes: axes.filter((axis) => axis.visible).length,
      choice_patterns: choicePatterns.length,
      visible_choice_patterns: choicePatterns.filter((pattern) => pattern.visible).length,
      human_review_rows: humanReviewRows.length,
    },
  };
}

export function writeC3RedZoneTaxonomy(data: C3TaxonomyData, outFile: string): void {
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`);
}

export function main(argv = process.argv.slice(2)): void {
  const sourceDir = argv[0] ?? DEFAULT_SOURCE_DIR;
  const outFile = argv[1] ?? DEFAULT_OUT_FILE;
  const data = buildC3RedZoneTaxonomy(sourceDir);
  writeC3RedZoneTaxonomy(data, outFile);
  console.log(JSON.stringify({ outFile, totals: data.totals }, null, 2));
}

const thisFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === path.resolve(thisFile)) {
  main();
}
