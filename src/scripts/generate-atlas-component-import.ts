// Atlas component packet importer.
//
// Reads C:\AAABM\finished outline-code packets and emits local projection files.
// It never connects to a database. SQL output is candidate-only by design.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const DEFAULT_SOURCE_DIR = "C:/AAABM/finished";
const DEFAULT_OUT_DIR = "C:/barmatrix-api/tasks/atlas-component-import-2026-06-21";

type JsonRecord = Record<string, unknown>;

export interface AtlasComponentPacket {
  source_file: string;
  outline_code: string;
  file_outline_code: string;
  packet_id: string | null;
  packet_verdict: string | null;
  subject: string | null;
  subject_enum: string | null;
  subject_display: string | null;
  subtopic: string | null;
  node_title: string | null;
  bridge: JsonRecord;
  ingestion: JsonRecord;
  warnings: string[];
}

interface Projection {
  packets: JsonRecord[];
  component_payload_rows: JsonRecord[];
  canonical_axes: JsonRecord[];
  axis_choice_patterns: JsonRecord[];
  prototype_answer_arrays: JsonRecord[];
  gold_keys: JsonRecord[];
  silver_keys: JsonRecord[];
  drill_seeds: JsonRecord[];
  question_mapping_template_rows: JsonRecord[];
  human_review_rows: JsonRecord[];
  debrief_elements: JsonRecord[];
  leadme_items: JsonRecord[];
  leadme_compiled_payloads: JsonRecord[];
  leadme_sets: JsonRecord[];
  leadme_set_entries: JsonRecord[];
  outline_node_attachments: JsonRecord[];
}

interface BuildResult {
  summary: JsonRecord;
  projection: Projection;
  failures: JsonRecord[];
}

const ARRAY_KEYS = [
  "canonical_axes",
  "axis_choice_patterns",
  "prototype_answer_arrays",
  "gold_keys",
  "silver_keys",
  "drill_seeds",
  "component_payload_rows",
  "question_mapping_template_rows",
  "human_review_rows",
] as const;

const REQUIRED_GATES = [
  "schema_valid",
  "outline_code_valid",
  "signals_not_deltas",
  "christian_theming_audit",
  "no_answer_leakage",
  "doctrine_gate",
  "legal_review",
] as const;

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

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function boundedId(prefix: string, raw: string): string {
  const cleaned = `${prefix}${raw}`.replace(/[^A-Za-z0-9_.:-]/g, "-").replace(/-+/g, "-");
  if (cleaned.length <= 128) return cleaned;
  return `${cleaned.slice(0, 95)}-${hash(cleaned).slice(0, 24)}`;
}

function sqlString(value: unknown): string {
  const text = str(value);
  if (!text) return "NULL";
  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function sqlInt(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "NULL";
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
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

export function parseAtlasComponentPacket(markdown: string, sourceFile = "packet.md"): AtlasComponentPacket {
  const yaml = extractInitialYaml(markdown);
  const bridge = asRecord(JSON.parse(extractFence(markdown, "component_bridge_json", "json")));
  const ingestion = asRecord(JSON.parse(extractFence(markdown, "ingestion_rows_json", "json")));

  const packet = asRecord(yaml.packet);
  const metadata = asRecord(packet.packet_metadata);
  const target = asRecord(packet.target_input_echo);
  const scope = asRecord(packet.node_scope_summary);
  const fileOutlineCode = path.basename(sourceFile, path.extname(sourceFile));
  const outlineCode = str(bridge.outline_code) ?? str(target.outline_code) ?? fileOutlineCode;
  const warnings: string[] = [];

  if (!/^[0-9]{8}$/.test(outlineCode)) warnings.push(`invalid outline_code ${outlineCode}`);
  if (outlineCode !== fileOutlineCode) {
    warnings.push(`file code ${fileOutlineCode} does not match packet code ${outlineCode}`);
  }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(ingestion[key])) warnings.push(`ingestion.${key} is missing or not an array`);
  }

  return {
    source_file: sourceFile,
    outline_code: outlineCode,
    file_outline_code: fileOutlineCode,
    packet_id: str(metadata.packet_id),
    packet_verdict: str(metadata.packet_verdict),
    subject: str(target.subject),
    subject_enum: str(target.subject_enum),
    subject_display: str(target.subject_display),
    subtopic: str(target.subtopic),
    node_title: str(scope.node_title),
    bridge,
    ingestion,
    warnings,
  };
}

function pushRows(
  projection: Projection,
  key: keyof Projection,
  packet: AtlasComponentPacket,
  rows: JsonRecord[],
) {
  for (const row of rows) {
    const normalizedRow =
      key === "component_payload_rows"
        ? { ...row, component_target: componentTarget(row) }
        : row;
    projection[key].push({
      ...normalizedRow,
      outline_code: str(normalizedRow.outline_code) ?? packet.outline_code,
      source_file: packet.source_file,
      packet_id: packet.packet_id,
      subject: packet.subject_enum,
      subtopic: packet.subtopic,
    });
  }
}

function componentTarget(row: JsonRecord): string | null {
  return str(row.component_target) ?? str(row.component);
}

function debriefElement(
  packet: AtlasComponentPacket,
  rawId: string,
  elementType: string,
  title: string,
  payload: JsonRecord,
): JsonRecord {
  return {
    element_id: boundedId("DEI-ATLAS-", rawId),
    element_type: elementType,
    title,
    status: "candidate",
    subject: packet.subject_enum,
    primary_outline_code: packet.outline_code,
    method_phase: str(payload.c3_phase),
    method_class: str(payload.method_class),
    governing_law_type: str(payload.governing_law_type),
    source_count: 0,
    review_status: "candidate",
    yaml_json_text: {
      source: "atlas_component_packet",
      source_file: packet.source_file,
      packet_id: packet.packet_id,
      packet_verdict: packet.packet_verdict,
      payload,
    },
  };
}

function leadmeItem(packet: AtlasComponentPacket, seed: JsonRecord): JsonRecord {
  const drillId = str(seed.drill_id) ?? `${packet.outline_code}-DRILL`;
  const payload = {
    schema_version: "atlas_component_drill_seed.v1",
    title: str(seed.prompt) ?? `Drill ${packet.outline_code}`,
    prompt: str(seed.prompt),
    axis_ids: Array.isArray(seed.axis_ids) ? seed.axis_ids : [],
    source_file: packet.source_file,
    packet_id: packet.packet_id,
  };
  const contentHash = hash(stableJson(payload));
  return {
    item_id: boundedId("LM-ATLAS-", drillId),
    external_id: boundedId("atlas-", drillId).toLowerCase(),
    schema_version: "atlas_component_drill_seed.v1",
    version: "v1",
    status: "candidate",
    item_type: "micro_drill",
    subject: packet.subject_enum,
    primary_outline_code: packet.outline_code,
    estimated_seconds: 180,
    content_hash: `sha256:${contentHash}`,
    authoring_yaml_text: null,
    compiled_json_text: payload,
  };
}

function leadmeCompiledPayload(item: JsonRecord): JsonRecord {
  const itemId = str(item.item_id) ?? "";
  const version = str(item.version) ?? "v1";
  const contentHash = str(item.content_hash) ?? "";
  const submitPrivate = {
    item_id: itemId,
    item_version: version,
    content_hash: contentHash,
    correct: [],
    responses: {},
  };
  const branchPrivate = {
    item_id: itemId,
    item_version: version,
    content_hash: contentHash,
    branches: {},
  };
  const scoringSignal = {
    item_id: itemId,
    item_version: version,
    content_hash: contentHash,
    responses: {},
  };
  const analyticsMetadata = {
    item_id: itemId,
    item_version: version,
    content_hash: contentHash,
    source: "atlas_component_packet",
    front_public_hash: `sha256:${hash(stableJson(item.compiled_json_text))}`,
    submit_private_hash: `sha256:${hash(stableJson(submitPrivate))}`,
    branch_private_hash: `sha256:${hash(stableJson(branchPrivate))}`,
    scoring_signal_payload_hash: `sha256:${hash(stableJson(scoringSignal))}`,
  };
  return {
    item_id: itemId,
    item_version: version,
    content_hash: contentHash,
    submit_private_json: submitPrivate,
    branch_private_json: branchPrivate,
    scoring_signal_json: scoringSignal,
    analytics_metadata_json: analyticsMetadata,
    compiled_server_payload_hash: `sha256:${hash(
      stableJson({
        submit_private: submitPrivate,
        branch_private: branchPrivate,
        scoring_signal_payload: scoringSignal,
      }),
    )}`,
  };
}

function addCandidateRows(projection: Projection, packet: AtlasComponentPacket) {
  const axes = asArray(packet.ingestion.canonical_axes);
  const patterns = asArray(packet.ingestion.axis_choice_patterns);
  const gold = asArray(packet.ingestion.gold_keys);
  const silver = asArray(packet.ingestion.silver_keys);
  const drills = asArray(packet.ingestion.drill_seeds);
  let sort = 1;

  for (const axis of axes) {
    const id = str(axis.axis_id);
    if (!id) continue;
    const element = debriefElement(
      packet,
      id,
      "tension",
      str(axis.axis_name) ?? id,
      axis,
    );
    projection.debrief_elements.push(element);
    projection.outline_node_attachments.push(attachment(packet, "debrief_element", str(element.element_id), sort++));
  }
  for (const pattern of patterns) {
    const id = str(pattern.choice_pattern_id);
    if (!id) continue;
    const title = [str(pattern.filter_broken), str(pattern.mold_code)].filter(Boolean).join(" / ") || id;
    const element = debriefElement(packet, id, "trap", title, pattern);
    projection.debrief_elements.push(element);
    projection.outline_node_attachments.push(attachment(packet, "debrief_element", str(element.element_id), sort++));
  }
  for (const key of gold) {
    const id = str(key.key_id);
    if (!id) continue;
    const element = debriefElement(packet, id, "gold_key", str(key.title) ?? id, key);
    projection.debrief_elements.push(element);
    projection.outline_node_attachments.push(attachment(packet, "debrief_element", str(element.element_id), sort++));
  }
  for (const key of silver) {
    const id = str(key.key_id);
    if (!id) continue;
    const element = debriefElement(packet, id, "silver_key", str(key.title) ?? id, key);
    projection.debrief_elements.push(element);
    projection.outline_node_attachments.push(attachment(packet, "debrief_element", str(element.element_id), sort++));
  }

  if (drills.length === 0) return;
  const setId = boundedId("LMS-ATLAS-", packet.outline_code);
  projection.leadme_sets.push({
    set_id: setId,
    version: "v1",
    status: "candidate",
    set_type: "guided_repair",
    title: `${packet.node_title ?? packet.outline_code} component drills`,
    primary_outline_code: packet.outline_code,
    compiled_policy_json: {
      source: "atlas_component_packet",
      source_file: packet.source_file,
      packet_id: packet.packet_id,
    },
  });

  drills.forEach((seed, index) => {
    const item = leadmeItem(packet, seed);
    projection.leadme_items.push(item);
    projection.leadme_compiled_payloads.push(leadmeCompiledPayload(item));
    projection.leadme_set_entries.push({
      set_id: setId,
      item_id: item.item_id,
      position: index + 1,
      role: "drill_seed",
      required: 0,
      selector_slot_id: null,
    });
    projection.outline_node_attachments.push(attachment(packet, "leadme_item", str(item.item_id), sort++));
  });
}

function attachment(
  packet: AtlasComponentPacket,
  attachmentType: string,
  attachmentId: string | null,
  sortOrder: number,
): JsonRecord {
  return {
    outline_code: packet.outline_code,
    attachment_type: attachmentType,
    attachment_id: attachmentId,
    role: "atlas_component_import",
    status: "candidate",
    sort_order: sortOrder,
    source_file: packet.source_file,
    packet_id: packet.packet_id,
  };
}

function emptyProjection(): Projection {
  return {
    packets: [],
    component_payload_rows: [],
    canonical_axes: [],
    axis_choice_patterns: [],
    prototype_answer_arrays: [],
    gold_keys: [],
    silver_keys: [],
    drill_seeds: [],
    question_mapping_template_rows: [],
    human_review_rows: [],
    debrief_elements: [],
    leadme_items: [],
    leadme_compiled_payloads: [],
    leadme_sets: [],
    leadme_set_entries: [],
    outline_node_attachments: [],
  };
}

export function buildAtlasComponentProjection(sourceDir: string): BuildResult {
  const files = existsSync(sourceDir)
    ? readdirSync(sourceDir).filter((name) => name.toLowerCase().endsWith(".md")).sort()
    : [];
  const projection = emptyProjection();
  const failures: JsonRecord[] = [];
  const seenCodes = new Map<string, number>();
  const componentTargets = new Map<string, number>();

  for (const file of files) {
    const fullPath = path.join(sourceDir, file);
    try {
      const packet = parseAtlasComponentPacket(readFileSync(fullPath, "utf8"), file);
      seenCodes.set(packet.outline_code, (seenCodes.get(packet.outline_code) ?? 0) + 1);

      const counts = Object.fromEntries(
        ARRAY_KEYS.map((key) => [key, asArray(packet.ingestion[key]).length]),
      );
      const targets = asArray(packet.ingestion.component_payload_rows)
        .map(componentTarget)
        .filter((value): value is string => Boolean(value));
      for (const target of targets) componentTargets.set(target, (componentTargets.get(target) ?? 0) + 1);

      projection.packets.push({
        source_file: packet.source_file,
        outline_code: packet.outline_code,
        packet_id: packet.packet_id,
        packet_verdict: packet.packet_verdict,
        subject: packet.subject_enum,
        subject_display: packet.subject_display,
        subtopic: packet.subtopic,
        node_title: packet.node_title,
        bridge_version: str(packet.bridge.component_bridge_version),
        component_targets: targets,
        counts,
        warnings: packet.warnings,
      });
      pushRows(projection, "component_payload_rows", packet, asArray(packet.ingestion.component_payload_rows));
      pushRows(projection, "canonical_axes", packet, asArray(packet.ingestion.canonical_axes));
      pushRows(projection, "axis_choice_patterns", packet, asArray(packet.ingestion.axis_choice_patterns));
      pushRows(projection, "prototype_answer_arrays", packet, asArray(packet.ingestion.prototype_answer_arrays));
      pushRows(projection, "gold_keys", packet, asArray(packet.ingestion.gold_keys));
      pushRows(projection, "silver_keys", packet, asArray(packet.ingestion.silver_keys));
      pushRows(projection, "drill_seeds", packet, asArray(packet.ingestion.drill_seeds));
      pushRows(
        projection,
        "question_mapping_template_rows",
        packet,
        asArray(packet.ingestion.question_mapping_template_rows),
      );
      pushRows(projection, "human_review_rows", packet, asArray(packet.ingestion.human_review_rows));
      addCandidateRows(projection, packet);
    } catch (error) {
      failures.push({
        source_file: file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const duplicateOutlineCodes = [...seenCodes.entries()]
    .filter(([, count]) => count > 1)
    .map(([code, count]) => ({ code, count }));
  const summary = {
    source_dir: sourceDir,
    files_found: files.length,
    packets_parsed: projection.packets.length,
    parse_failures: failures.length,
    unique_outline_codes: seenCodes.size,
    duplicate_outline_codes: duplicateOutlineCodes,
    component_target_counts: Object.fromEntries([...componentTargets.entries()].sort()),
    row_counts: Object.fromEntries(
      Object.entries(projection).map(([key, rows]) => [key, rows.length]),
    ),
  };
  return { summary, projection, failures };
}

function writeJsonl(file: string, rows: JsonRecord[]) {
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function renderSql(projection: Projection): string {
  const lines: string[] = [
    "-- Generated by src/scripts/generate-atlas-component-import.ts",
    "-- Candidate-only projection. Review and promote gates before making content student-visible.",
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "",
  ];

  for (const row of projection.debrief_elements) {
    lines.push(
      `INSERT INTO debrief_elements (element_id, element_type, title, status, subject, primary_outline_code, method_phase, method_class, governing_law_type, source_count, review_status, yaml_json_text) VALUES (${sqlString(row.element_id)}, ${sqlString(row.element_type)}, ${sqlString(row.title)}, 'candidate', ${sqlString(row.subject)}, ${sqlString(row.primary_outline_code)}, ${sqlString(row.method_phase)}, ${sqlString(row.method_class)}, ${sqlString(row.governing_law_type)}, ${sqlInt(row.source_count)}, 'candidate', ${sqlJson(row.yaml_json_text)}) ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), subject = VALUES(subject), primary_outline_code = VALUES(primary_outline_code), method_phase = VALUES(method_phase), method_class = VALUES(method_class), governing_law_type = VALUES(governing_law_type), source_count = VALUES(source_count), review_status = VALUES(review_status), yaml_json_text = VALUES(yaml_json_text);`,
    );
  }
  for (const row of projection.leadme_items) {
    lines.push(
      `INSERT INTO leadme_items (item_id, external_id, schema_version, version, status, item_type, subject, primary_outline_code, estimated_seconds, content_hash, authoring_yaml_text, compiled_json_text) VALUES (${sqlString(row.item_id)}, ${sqlString(row.external_id)}, ${sqlString(row.schema_version)}, ${sqlString(row.version)}, 'candidate', ${sqlString(row.item_type)}, ${sqlString(row.subject)}, ${sqlString(row.primary_outline_code)}, ${sqlInt(row.estimated_seconds)}, ${sqlString(row.content_hash)}, NULL, ${sqlJson(row.compiled_json_text)}) ON DUPLICATE KEY UPDATE version = VALUES(version), status = VALUES(status), item_type = VALUES(item_type), subject = VALUES(subject), primary_outline_code = VALUES(primary_outline_code), estimated_seconds = VALUES(estimated_seconds), content_hash = VALUES(content_hash), compiled_json_text = VALUES(compiled_json_text);`,
    );
    for (const gate of REQUIRED_GATES) {
      lines.push(
        `INSERT INTO content_promotion_gates (object_id, object_type, object_version, content_hash, gate_name, gate_status, notes) VALUES (${sqlString(row.item_id)}, 'leadme_item', ${sqlString(row.version)}, ${sqlString(row.content_hash)}, '${gate}', 'pending', 'atlas component import candidate') ON DUPLICATE KEY UPDATE gate_status = VALUES(gate_status), notes = VALUES(notes);`,
      );
    }
  }
  for (const row of projection.leadme_compiled_payloads) {
    lines.push(
      `INSERT INTO leadme_compiled_payloads (item_id, item_version, content_hash, submit_private_json, branch_private_json, scoring_signal_json, analytics_metadata_json, compiled_server_payload_hash) VALUES (${sqlString(row.item_id)}, ${sqlString(row.item_version)}, ${sqlString(row.content_hash)}, ${sqlJson(row.submit_private_json)}, ${sqlJson(row.branch_private_json)}, ${sqlJson(row.scoring_signal_json)}, ${sqlJson(row.analytics_metadata_json)}, ${sqlString(row.compiled_server_payload_hash)}) ON DUPLICATE KEY UPDATE submit_private_json = VALUES(submit_private_json), branch_private_json = VALUES(branch_private_json), scoring_signal_json = VALUES(scoring_signal_json), analytics_metadata_json = VALUES(analytics_metadata_json), compiled_server_payload_hash = VALUES(compiled_server_payload_hash);`,
    );
  }
  for (const row of projection.leadme_sets) {
    lines.push(
      `INSERT INTO leadme_sets (set_id, version, status, set_type, title, primary_outline_code, compiled_policy_json) VALUES (${sqlString(row.set_id)}, ${sqlString(row.version)}, 'candidate', ${sqlString(row.set_type)}, ${sqlString(row.title)}, ${sqlString(row.primary_outline_code)}, ${sqlJson(row.compiled_policy_json)}) ON DUPLICATE KEY UPDATE version = VALUES(version), status = VALUES(status), set_type = VALUES(set_type), title = VALUES(title), primary_outline_code = VALUES(primary_outline_code), compiled_policy_json = VALUES(compiled_policy_json);`,
    );
  }
  for (const row of projection.leadme_set_entries) {
    lines.push(
      `INSERT INTO leadme_set_entries (set_id, item_id, position, role, required, selector_slot_id) VALUES (${sqlString(row.set_id)}, ${sqlString(row.item_id)}, ${sqlInt(row.position)}, ${sqlString(row.role)}, ${sqlInt(row.required)}, ${sqlString(row.selector_slot_id)}) ON DUPLICATE KEY UPDATE position = VALUES(position), role = VALUES(role), required = VALUES(required), selector_slot_id = VALUES(selector_slot_id);`,
    );
  }
  for (const row of projection.outline_node_attachments) {
    lines.push(
      `INSERT INTO outline_node_attachments (outline_code, attachment_type, attachment_id, role, status, sort_order) VALUES (${sqlString(row.outline_code)}, ${sqlString(row.attachment_type)}, ${sqlString(row.attachment_id)}, ${sqlString(row.role)}, 'candidate', ${sqlInt(row.sort_order)});`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderMarkdown(summary: JsonRecord): string {
  const rowCounts = asRecord(summary.row_counts);
  const targets = asRecord(summary.component_target_counts);
  const targetLines = Object.entries(targets)
    .map(([target, count]) => `- ${target}: ${count}`)
    .join("\n");

  return `# Atlas Component Import Projection

Source: \`${summary.source_dir}\`

## Summary

- Files found: ${summary.files_found}
- Packets parsed: ${summary.packets_parsed}
- Parse failures: ${summary.parse_failures}
- Unique outline codes: ${summary.unique_outline_codes}
- Duplicate outline codes: ${Array.isArray(summary.duplicate_outline_codes) ? summary.duplicate_outline_codes.length : 0}

## Row Counts

${Object.entries(rowCounts)
  .map(([key, count]) => `- ${key}: ${count}`)
  .join("\n")}

## Component Targets

${targetLines}

## Gate

The SQL projection is candidate-only. Do not run it against production until the rows are reviewed and promotion gates are intentionally advanced.
`;
}

export function writeAtlasComponentProjection(result: BuildResult, outDir: string) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(result.summary, null, 2));
  writeFileSync(path.join(outDir, "summary.md"), renderMarkdown(result.summary));
  writeJsonl(path.join(outDir, "parse_failures.jsonl"), result.failures);
  for (const [key, rows] of Object.entries(result.projection)) {
    writeJsonl(path.join(outDir, `${key}.jsonl`), rows as JsonRecord[]);
  }
  writeFileSync(path.join(outDir, "LOAD_ATLAS_COMPONENT_CANDIDATES.sql"), renderSql(result.projection));
}

export function main(argv = process.argv.slice(2)) {
  const sourceDir = argv[0] ?? DEFAULT_SOURCE_DIR;
  const outDir = argv[1] ?? DEFAULT_OUT_DIR;
  const result = buildAtlasComponentProjection(sourceDir);
  writeAtlasComponentProjection(result, outDir);
  console.log(JSON.stringify({ outDir, ...result.summary }, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

const thisFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === path.resolve(thisFile)) {
  main();
}
