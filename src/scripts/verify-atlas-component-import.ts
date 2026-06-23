import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_IMPORT_DIR = "C:/barmatrix-api/tasks/atlas-component-import-2026-06-21";
const DEFAULT_LOCAL_V2_OUTLINE_SQL = "C:/BMO/BARMATRIX/engineering/V2_OUTLINE_ATLAS_LOAD.sql";
const PREFLIGHT_SQL_FILE = "PREFLIGHT_ATLAS_COMPONENT_IMPORT.sql";
const ROLLBACK_SQL_FILE = "ROLLBACK_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql";
const PROMOTION_SQL_FILE = "PROMOTE_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql";
const LOCAL_ATLAS_CODE_PREFLIGHT_FILE = "LOCAL_ATLAS_CODE_PREFLIGHT.json";
const LOCAL_OUTLINE_SOURCE_TABLE = "outline_nodes";
const API_RUNTIME_OUTLINE_TABLE = "atlas_outline_nodes";
const OUTLINE_CODE_RE = /^\d{8}$/;

type JsonRecord = Record<string, unknown>;
type FindingLevel = "pass" | "fail" | "gate";

export interface AtlasImportReadinessReport {
  outDir: string;
  package_status: "pass" | "fail";
  live_import_gate: "closed";
  findings: { level: FindingLevel; message: string }[];
  counts: JsonRecord;
  human_review_rows: JsonRecord[];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readJson(file: string): JsonRecord {
  return asRecord(JSON.parse(readFileSync(file, "utf8")));
}

function readJsonl(file: string): JsonRecord[] {
  const text = readFileSync(file, "utf8").trim();
  return text ? text.split(/\r?\n/).map((line) => asRecord(JSON.parse(line))) : [];
}

function rowKey(row: JsonRecord): string {
  return `${String(row.item_id)}::${String(row.version ?? row.item_version)}::${String(row.content_hash)}`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sqlInsertCount(sql: string): number {
  return sql.split(/\r?\n/).filter((line) => line.startsWith("INSERT INTO ")).length;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function blockedMarkers(rows: JsonRecord[]): string[] {
  return [
    ...new Set(
      rows
        .flatMap((row) => [text(row.outline_code), text(row.packet_id), text(row.source_file)])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function sqlString(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function sqlRows(column: string, values: string[]): string {
  if (values.length === 0) return `SELECT NULL AS ${column} WHERE 1 = 0`;
  return values.map((value) => `SELECT ${sqlString(value)} AS ${column}`).join("\nUNION ALL\n");
}

function uniqueTexts(rows: JsonRecord[], key: string): string[] {
  return [...new Set(rows.map((row) => text(row[key])).filter((value): value is string => Boolean(value)))].sort();
}

export function extractAtlasCodesFromSql(sql: string): string[] {
  return [...new Set([...sql.matchAll(/'\d{8}'/g)].map((match) => match[0].slice(1, -1)))].sort();
}

function buildLocalAtlasCodePreflight(
  packageCodes: string[],
  unblockedCodes: string[],
  blockedCodes: string[],
  atlasSqlPath = DEFAULT_LOCAL_V2_OUTLINE_SQL,
): JsonRecord {
  const base = {
    coverage_scope: "local_v2_outline_nodes_load",
    local_source_table: LOCAL_OUTLINE_SOURCE_TABLE,
    api_runtime_table: API_RUNTIME_OUTLINE_TABLE,
    api_runtime_table_local_sql_status: "not_found",
    db_preflight_required_for_api_table: true,
    atlas_sql_path: atlasSqlPath,
    package_code_count: packageCodes.length,
    unblocked_code_count: unblockedCodes.length,
    blocked_code_count: blockedCodes.length,
  };
  if (!existsSync(atlasSqlPath)) {
    return {
      ...base,
      status: "not_run",
      reason: "missing_local_atlas_sql",
    };
  }
  const atlasCodes = extractAtlasCodesFromSql(readFileSync(atlasSqlPath, "utf8"));
  const atlasCodeSet = new Set(atlasCodes);
  const missingPackageCodes = packageCodes.filter((code) => !atlasCodeSet.has(code));
  const missingUnblockedCodes = unblockedCodes.filter((code) => !atlasCodeSet.has(code));
  const missingBlockedCodes = blockedCodes.filter((code) => !atlasCodeSet.has(code));
  return {
    ...base,
    status: missingUnblockedCodes.length === 0 ? "pass" : "fail",
    atlas_code_count: atlasCodes.length,
    local_v2_outline_code_count: atlasCodes.length,
    missing_package_codes: missingPackageCodes,
    missing_unblocked_codes: missingUnblockedCodes,
    missing_blocked_codes: missingBlockedCodes,
  };
}

function renderUnblockedSql(sql: string, markers: string[]): string {
  if (markers.length === 0) return sql;
  return `${sql
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("INSERT INTO ") || !markers.some((marker) => line.includes(marker)))
    .join("\n")
    .trimEnd()}\n`;
}

function unblockedRows(rows: JsonRecord[], markers: string[]): JsonRecord[] {
  if (markers.length === 0) return rows;
  return rows.filter((row) => !markers.some((marker) => JSON.stringify(row).includes(marker)));
}

function chunks<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function renderValues(values: string[]): string {
  return values.map(sqlString).join(", ");
}

function renderTuples(rows: string[][]): string {
  return rows.map((row) => `(${row.map(sqlString).join(", ")})`).join(",\n  ");
}

function renderIdDeletes(table: string, column: string, values: string[], guard: string): string[] {
  return chunks([...new Set(values)].sort()).map(
    (chunk) => `DELETE FROM ${table} WHERE ${guard} AND ${column} IN (${renderValues(chunk)});`,
  );
}

function renderTupleDeletes(
  table: string,
  columns: string[],
  rows: string[][],
  guard: string,
): string[] {
  const uniqueRows = [
    ...new Map(rows.map((row) => [row.join("\u0000"), row])).values(),
  ].sort((a, b) => a.join("\u0000").localeCompare(b.join("\u0000")));
  return chunks(uniqueRows).map(
    (chunk) =>
      `DELETE FROM ${table} WHERE ${guard} AND (${columns.join(", ")}) IN (\n  ${renderTuples(chunk)}\n);`,
  );
}

function requiredGateRows(): string {
  const gates = [
    "schema_valid",
    "outline_code_valid",
    "signals_not_deltas",
    "christian_theming_audit",
    "no_answer_leakage",
    "doctrine_gate",
    "legal_review",
  ];
  return gates.map((gate, index) => `SELECT ${sqlString(gate)}${index === 0 ? " AS gate_name" : ""}`).join("\nUNION ALL\n");
}

function allLeadMeGatesPassedClause(leadmeItems: JsonRecord[]): string {
  const itemIds = uniqueTexts(leadmeItems, "item_id");
  if (itemIds.length === 0) return "1 = 0";
  return `NOT EXISTS (
  SELECT 1
    FROM leadme_items li_gate
    JOIN (
${requiredGateRows()}
    ) required_gates
    LEFT JOIN content_promotion_gates g
      ON g.object_id = li_gate.item_id
     AND g.object_type = 'leadme_item'
     AND g.object_version = li_gate.version
     AND g.content_hash = li_gate.content_hash
     AND g.gate_name = required_gates.gate_name
   WHERE li_gate.item_id IN (${renderValues(itemIds)})
     AND COALESCE(g.gate_status, 'missing') <> 'passed'
)`;
}

function renderPromotionSql(rows: {
  debriefElements: JsonRecord[];
  leadmeItems: JsonRecord[];
  leadmeSets: JsonRecord[];
  attachments: JsonRecord[];
}): string {
  const leadmeItemIds = uniqueTexts(rows.leadmeItems, "item_id");
  const leadmeSetIds = uniqueTexts(rows.leadmeSets, "set_id");
  const debriefElementIds = uniqueTexts(rows.debriefElements, "element_id");
  const attachmentRows = rows.attachments.map((row) => [
    String(row.outline_code),
    String(row.attachment_type),
    String(row.attachment_id),
    String(row.role),
  ]);
  const lines = [
    "-- Generated by src/scripts/verify-atlas-component-import.ts",
    "-- Student-visible phase two. Run only after candidate import, DB preflight, and promotion gates pass.",
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "",
  ];

  for (const itemIds of chunks(leadmeItemIds)) {
    lines.push(`UPDATE leadme_items li
   SET status = 'active'
 WHERE status = 'candidate'
   AND item_id IN (${renderValues(itemIds)})
   AND NOT EXISTS (
     SELECT 1
       FROM (
${requiredGateRows()}
       ) required_gates
       LEFT JOIN content_promotion_gates g
         ON g.object_id = li.item_id
        AND g.object_type = 'leadme_item'
        AND g.object_version = li.version
        AND g.content_hash = li.content_hash
        AND g.gate_name = required_gates.gate_name
      WHERE COALESCE(g.gate_status, 'missing') <> 'passed'
   );`);
  }

  for (const setIds of chunks(leadmeSetIds)) {
    lines.push(`UPDATE leadme_sets s
   SET status = 'active'
 WHERE status = 'candidate'
   AND set_id IN (${renderValues(setIds)})
   AND NOT EXISTS (
     SELECT 1
       FROM leadme_set_entries e
       LEFT JOIN leadme_items li ON li.item_id = e.item_id
      WHERE e.set_id = s.set_id
        AND (li.item_id IS NULL OR li.status NOT IN ('active', 'published'))
   );`);
  }

  for (const elementIds of chunks(debriefElementIds)) {
    lines.push(`UPDATE debrief_elements de
   SET status = 'core',
       review_status = 'legal_reviewed'
 WHERE status = 'candidate'
   AND element_id IN (${renderValues(elementIds)})
   AND ${allLeadMeGatesPassedClause(rows.leadmeItems)};`);
  }

  for (const attachmentChunk of chunks(attachmentRows)) {
    lines.push(`UPDATE outline_node_attachments a
   LEFT JOIN leadme_items li
     ON a.attachment_type = 'leadme_item'
    AND li.item_id = a.attachment_id
   LEFT JOIN debrief_elements de
     ON a.attachment_type = 'debrief_element'
    AND de.element_id = a.attachment_id
   SET a.status = 'active'
 WHERE a.status = 'candidate'
   AND (a.outline_code, a.attachment_type, a.attachment_id, a.role) IN (
  ${renderTuples(attachmentChunk)}
)
   AND (
     (a.attachment_type = 'leadme_item' AND li.status IN ('active', 'published'))
     OR (a.attachment_type = 'debrief_element'
       AND de.status IN ('active', 'core')
       AND de.review_status IN ('approved', 'reviewed', 'legal_reviewed', 'active'))
   );`);
  }

  return `${lines.filter(Boolean).join("\n")}\n`;
}

function renderRollbackSql(rows: {
  debriefElements: JsonRecord[];
  leadmeItems: JsonRecord[];
  compiledPayloads: JsonRecord[];
  leadmeSets: JsonRecord[];
  setEntries: JsonRecord[];
  attachments: JsonRecord[];
}): string {
  const lines = [
    "-- Generated by src/scripts/verify-atlas-component-import.ts",
    "-- Rollback for LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql candidate rows only.",
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "",
  ];
  lines.push(
    ...renderTupleDeletes(
      "outline_node_attachments",
      ["outline_code", "attachment_type", "attachment_id", "role"],
      rows.attachments.map((row) => [
        String(row.outline_code),
        String(row.attachment_type),
        String(row.attachment_id),
        String(row.role),
      ]),
      "status = 'candidate'",
    ),
  );
  lines.push(
    ...renderTupleDeletes(
      "leadme_set_entries",
      ["set_id", "item_id"],
      rows.setEntries.map((row) => [String(row.set_id), String(row.item_id)]),
      "1 = 1",
    ),
  );
  lines.push(
    ...renderTupleDeletes(
      "content_promotion_gates",
      ["object_id", "object_version", "content_hash"],
      rows.leadmeItems.map((row) => [String(row.item_id), String(row.version), String(row.content_hash)]),
      "object_type = 'leadme_item' AND gate_status = 'pending' AND notes = 'atlas component import candidate'",
    ),
  );
  lines.push(
    ...renderTupleDeletes(
      "leadme_compiled_payloads",
      ["item_id", "item_version", "content_hash"],
      rows.compiledPayloads.map((row) => [
        String(row.item_id),
        String(row.item_version),
        String(row.content_hash),
      ]),
      "1 = 1",
    ),
  );
  lines.push(
    ...renderIdDeletes(
      "leadme_sets",
      "set_id",
      rows.leadmeSets.map((row) => String(row.set_id)),
      "status = 'candidate'",
    ),
  );
  lines.push(
    ...renderIdDeletes(
      "leadme_items",
      "item_id",
      rows.leadmeItems.map((row) => String(row.item_id)),
      "status = 'candidate'",
    ),
  );
  lines.push(
    ...renderIdDeletes(
      "debrief_elements",
      "element_id",
      rows.debriefElements.map((row) => String(row.element_id)),
      "status = 'candidate'",
    ),
  );
  return `${lines.filter(Boolean).join("\n")}\n`;
}

function renderPreflightSql(candidateCodes: string[], blockedCodes: string[]): string {
  const tableRows = sqlRows("table_name", [
    "atlas_outline_nodes",
    "content_promotion_gates",
    "debrief_elements",
    "leadme_compiled_payloads",
    "leadme_items",
    "leadme_set_entries",
    "leadme_sets",
    "outline_node_attachments",
  ]);
  const expectedColumns: [string, string][] = [
    ["atlas_outline_nodes", "code"],
    ["content_promotion_gates", "object_id"],
    ["content_promotion_gates", "object_type"],
    ["content_promotion_gates", "object_version"],
    ["content_promotion_gates", "content_hash"],
    ["content_promotion_gates", "gate_name"],
    ["content_promotion_gates", "gate_status"],
    ["debrief_elements", "element_id"],
    ["debrief_elements", "status"],
    ["debrief_elements", "primary_outline_code"],
    ["leadme_compiled_payloads", "item_id"],
    ["leadme_compiled_payloads", "item_version"],
    ["leadme_compiled_payloads", "content_hash"],
    ["leadme_items", "item_id"],
    ["leadme_items", "version"],
    ["leadme_items", "status"],
    ["leadme_items", "primary_outline_code"],
    ["leadme_items", "content_hash"],
    ["leadme_set_entries", "set_id"],
    ["leadme_set_entries", "item_id"],
    ["leadme_set_entries", "position"],
    ["leadme_sets", "set_id"],
    ["leadme_sets", "version"],
    ["leadme_sets", "status"],
    ["leadme_sets", "primary_outline_code"],
    ["outline_node_attachments", "outline_code"],
    ["outline_node_attachments", "attachment_type"],
    ["outline_node_attachments", "attachment_id"],
    ["outline_node_attachments", "role"],
    ["outline_node_attachments", "status"],
  ];
  const columnRows = expectedColumns
    .map(([tableName, columnName]) => `SELECT ${sqlString(tableName)} AS table_name, ${sqlString(columnName)} AS column_name`)
    .join("\nUNION ALL\n");
  const codeRows = sqlRows("outline_code", candidateCodes);
  const blockedCodeRows = sqlRows("outline_code", blockedCodes);

  return `-- Generated by src/scripts/verify-atlas-component-import.ts
-- Read-only preflight for the unblocked Atlas component import package.
-- Expected import package: LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql
-- Run this before any import SQL. Non-empty missing_* result sets are blockers.

WITH expected_tables AS (
${tableRows}
)
SELECT 'required_tables' AS check_name, COUNT(t.table_name) AS found, COUNT(*) AS expected
FROM expected_tables e
LEFT JOIN information_schema.tables t
  ON t.table_schema = DATABASE()
 AND t.table_name = e.table_name;

WITH expected_columns AS (
${columnRows}
)
SELECT e.table_name, e.column_name
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = DATABASE()
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
WHERE c.column_name IS NULL
ORDER BY e.table_name, e.column_name;

WITH candidate_outline_codes AS (
${codeRows}
)
SELECT 'candidate_outline_nodes' AS check_name,
       COUNT(DISTINCT n.code) AS found,
       (SELECT COUNT(*) FROM candidate_outline_codes) AS expected
FROM candidate_outline_codes c
LEFT JOIN atlas_outline_nodes n ON n.code = c.outline_code;

WITH candidate_outline_codes AS (
${codeRows}
)
SELECT c.outline_code AS missing_outline_code
FROM candidate_outline_codes c
LEFT JOIN atlas_outline_nodes n ON n.code = c.outline_code
WHERE n.code IS NULL
ORDER BY c.outline_code;

SELECT 'existing_debrief_import_namespace' AS check_name, COUNT(*) AS existing_rows
FROM debrief_elements
WHERE element_id LIKE 'DEI-ATLAS-%';

SELECT 'existing_leadme_item_import_namespace' AS check_name, COUNT(*) AS existing_rows
FROM leadme_items
WHERE item_id LIKE 'LM-ATLAS-%';

SELECT 'existing_leadme_set_import_namespace' AS check_name, COUNT(*) AS existing_rows
FROM leadme_sets
WHERE set_id LIKE 'LMS-ATLAS-%';

SELECT 'existing_promotion_gate_import_namespace' AS check_name, COUNT(*) AS existing_rows
FROM content_promotion_gates
WHERE object_id LIKE 'LM-ATLAS-%';

WITH blocked_outline_codes AS (
${blockedCodeRows}
)
SELECT 'blocked_outline_attachment_rows' AS check_name, COUNT(*) AS existing_rows
FROM outline_node_attachments
WHERE outline_code IN (SELECT outline_code FROM blocked_outline_codes);
`;
}

function assertReadOnlyPreflight(sql: string): boolean {
  return !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|REPLACE)\b/i.test(sql);
}

function renderMarkdown(report: AtlasImportReadinessReport): string {
  const findingLines = report.findings
    .map((finding) => `- ${finding.level.toUpperCase()}: ${finding.message}`)
    .join("\n");
  const reviewLines = report.human_review_rows
    .map(
      (row) =>
        `- ${row.source_file}: ${row.flag_id} - ${row.required_review ?? row.reason ?? "Review required"}`,
    )
    .join("\n");

  return `# Atlas Component Import Readiness

Package status: ${report.package_status}
Live import gate: ${report.live_import_gate}

## Findings

${findingLines}

## Runbook

Dry-run the unblocked candidate import:

~~~powershell
npx tsx src/scripts/apply-atlas-component-import.ts
~~~

Dry-run the student-visible promotion step:

~~~powershell
npx tsx src/scripts/apply-atlas-component-import.ts --phase promotion
~~~

After explicit approval, DB env, and a passing read-only DB preflight, run candidate import first:

~~~powershell
npx tsx src/scripts/apply-atlas-component-import.ts --apply
~~~

After candidate import and passed promotion gates, run promotion:

~~~powershell
npx tsx src/scripts/apply-atlas-component-import.ts --phase promotion --apply
~~~

## Human Review Rows

${reviewLines || "- None"}
`;
}

export function verifyAtlasComponentImport(outDir = DEFAULT_IMPORT_DIR): AtlasImportReadinessReport {
  const findings: AtlasImportReadinessReport["findings"] = [];
  const add = (level: FindingLevel, message: string) => findings.push({ level, message });
  const requiredFiles = [
    "summary.json",
    "packets.jsonl",
    "parse_failures.jsonl",
    "leadme_items.jsonl",
    "leadme_compiled_payloads.jsonl",
    "leadme_sets.jsonl",
    "leadme_set_entries.jsonl",
    "debrief_elements.jsonl",
    "outline_node_attachments.jsonl",
    "LOAD_ATLAS_COMPONENT_CANDIDATES.sql",
  ];

  for (const file of requiredFiles) {
    add(existsSync(path.join(outDir, file)) ? "pass" : "fail", `${file} exists`);
  }

  const summary = readJson(path.join(outDir, "summary.json"));
  const counts = asRecord(summary.row_counts);
  const packets = readJsonl(path.join(outDir, "packets.jsonl"));
  const parseFailures = readJsonl(path.join(outDir, "parse_failures.jsonl"));
  const leadmeItems = readJsonl(path.join(outDir, "leadme_items.jsonl"));
  const compiledPayloads = readJsonl(path.join(outDir, "leadme_compiled_payloads.jsonl"));
  const debriefElements = readJsonl(path.join(outDir, "debrief_elements.jsonl"));
  const leadmeSets = readJsonl(path.join(outDir, "leadme_sets.jsonl"));
  const setEntries = readJsonl(path.join(outDir, "leadme_set_entries.jsonl"));
  const attachments = readJsonl(path.join(outDir, "outline_node_attachments.jsonl"));
  const humanReviewRows = readJsonl(path.join(outDir, "human_review_rows.jsonl"));
  const sql = readFileSync(path.join(outDir, "LOAD_ATLAS_COMPONENT_CANDIDATES.sql"), "utf8");
  const humanReviewNotesExist = existsSync(path.join(outDir, "HUMAN_REVIEW_NOTES.md"));
  const filesFound = Number(summary.files_found);
  const packetsParsed = Number(summary.packets_parsed);
  const parseFailureCount = Number(summary.parse_failures);
  const markers = blockedMarkers(humanReviewRows);
  const unblockedSql = renderUnblockedSql(sql, markers);
  const rollbackRows = {
    debriefElements: unblockedRows(debriefElements, markers),
    leadmeItems: unblockedRows(leadmeItems, markers),
    compiledPayloads: unblockedRows(compiledPayloads, markers),
    leadmeSets: unblockedRows(leadmeSets, markers),
    setEntries: unblockedRows(setEntries, markers),
    attachments: unblockedRows(attachments, markers),
  };
  const rollbackSql = renderRollbackSql(rollbackRows);
  const promotionSql = renderPromotionSql(rollbackRows);
  const unblockedSqlFile = "LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql";
  const blockedOutlineCodes = uniqueTexts(humanReviewRows, "outline_code").filter((code) => OUTLINE_CODE_RE.test(code));
  const packageOutlineCodes = uniqueTexts(packets, "outline_code").filter((code) => OUTLINE_CODE_RE.test(code));
  const unblockedOutlineCodes = uniqueTexts(packets, "outline_code")
    .filter((code) => OUTLINE_CODE_RE.test(code))
    .filter((code) => !blockedOutlineCodes.includes(code));
  const preflightSql = renderPreflightSql(unblockedOutlineCodes, blockedOutlineCodes);
  const localAtlasCodePreflight = buildLocalAtlasCodePreflight(
    packageOutlineCodes,
    unblockedOutlineCodes,
    blockedOutlineCodes,
  );
  const originalInsertCount = sqlInsertCount(sql);
  const unblockedInsertCount = sqlInsertCount(unblockedSql);
  const subsetManifest = {
    source_sql: "LOAD_ATLAS_COMPONENT_CANDIDATES.sql",
    unblocked_sql: unblockedSqlFile,
    original_insert_count: originalInsertCount,
    unblocked_insert_count: unblockedInsertCount,
    excluded_insert_count: originalInsertCount - unblockedInsertCount,
    unblocked_sql_sha256: sha256(unblockedSql),
    rollback_sql: ROLLBACK_SQL_FILE,
    rollback_sql_sha256: sha256(rollbackSql),
    student_visible_promotion_sql: PROMOTION_SQL_FILE,
    student_visible_promotion_sql_sha256: sha256(promotionSql),
    student_visible_promotion_gate: "requires candidate import, DB preflight, and passed leadme_item promotion gates",
    local_atlas_code_preflight: LOCAL_ATLAS_CODE_PREFLIGHT_FILE,
    blocked_markers: markers,
    blocked_rows: humanReviewRows.map((row) => ({
      outline_code: row.outline_code,
      packet_id: row.packet_id,
      source_file: row.source_file,
      flag_id: row.flag_id,
      reason: row.reason,
    })),
    live_import_gate: "closed",
  };

  writeFileSync(path.join(outDir, unblockedSqlFile), unblockedSql);
  writeFileSync(path.join(outDir, ROLLBACK_SQL_FILE), rollbackSql);
  writeFileSync(path.join(outDir, PROMOTION_SQL_FILE), promotionSql);
  writeFileSync(path.join(outDir, PREFLIGHT_SQL_FILE), preflightSql);
  writeFileSync(path.join(outDir, LOCAL_ATLAS_CODE_PREFLIGHT_FILE), JSON.stringify(localAtlasCodePreflight, null, 2));
  writeFileSync(path.join(outDir, "PROMOTION_SUBSET_MANIFEST.json"), JSON.stringify(subsetManifest, null, 2));
  writeFileSync(path.join(outDir, "BLOCKED_OUTLINE_CODES.json"), JSON.stringify(subsetManifest.blocked_rows, null, 2));

  add(Number(summary.parse_failures) === 0 && parseFailures.length === 0 ? "pass" : "fail", "no parse failures");
  add(filesFound > 0 ? "pass" : "fail", "source packets found");
  add(
    packetsParsed + parseFailureCount === filesFound ? "pass" : "fail",
    "packet parse totals match source files",
  );
  add(Number(counts.leadme_items) === leadmeItems.length ? "pass" : "fail", "leadme_items count matches JSONL");
  add(
    Number(counts.leadme_compiled_payloads) === compiledPayloads.length ? "pass" : "fail",
    "leadme_compiled_payloads count matches JSONL",
  );

  const payloadKeys = new Set(compiledPayloads.map(rowKey));
  const missingPayloads = leadmeItems.filter((row) => !payloadKeys.has(rowKey(row)));
  add(missingPayloads.length === 0 ? "pass" : "fail", "every LeadMe item has a compiled payload row");
  add(
    sql.includes("INSERT INTO leadme_compiled_payloads") ? "pass" : "fail",
    "candidate SQL writes LeadMe compiled payloads",
  );
  add(
    sql.includes("INSERT INTO content_promotion_gates") ? "pass" : "fail",
    "candidate SQL writes promotion gates",
  );
  add(humanReviewRows.length > 0 ? "gate" : "pass", `${humanReviewRows.length} human review rows before promotion`);
  if (humanReviewRows.length > 0) {
    add(humanReviewNotesExist ? "pass" : "fail", "human review notes exist");
    add(
      markers.every((marker) => !unblockedSql.includes(marker)) ? "pass" : "fail",
      "unblocked candidate SQL excludes blocked outline codes and packet ids",
    );
    add(
      unblockedInsertCount < originalInsertCount ? "pass" : "fail",
      "unblocked candidate SQL removed blocked candidate rows",
    );
  }
  add(unblockedInsertCount > 0 ? "pass" : "fail", "unblocked candidate SQL has candidate rows");
  add(rollbackSql.includes("DELETE FROM ") ? "pass" : "fail", "rollback SQL deletes package candidate rows");
  add(
    promotionSql.includes("UPDATE leadme_items") && promotionSql.includes("COALESCE(g.gate_status, 'missing') <> 'passed'")
      ? "pass"
      : "fail",
    "student-visible promotion SQL is guarded by passed promotion gates",
  );
  add("gate", "student-visible Atlas components require phase-two promotion after candidate import");
  add(
    markers.every((marker) => !rollbackSql.includes(marker)) ? "pass" : "fail",
    "rollback SQL excludes blocked outline codes and packet ids",
  );
  add(
    markers.every((marker) => !promotionSql.includes(marker)) ? "pass" : "fail",
    "student-visible promotion SQL excludes blocked outline codes and packet ids",
  );
  add(
    localAtlasCodePreflight.status === "pass"
      ? "pass"
      : localAtlasCodePreflight.status === "fail"
        ? "fail"
        : "gate",
    "local V2 outline_nodes load covers unblocked outline codes",
  );
  add("gate", "live atlas_outline_nodes coverage requires DB preflight");
  add(unblockedOutlineCodes.length > 0 ? "pass" : "fail", "preflight SQL has unblocked outline codes to check");
  add(assertReadOnlyPreflight(preflightSql) ? "pass" : "fail", "preflight SQL is read-only");
  add("gate", "live DB import requires explicit approval after review gates pass");

  const report: AtlasImportReadinessReport = {
    outDir,
    package_status: findings.some((finding) => finding.level === "fail") ? "fail" : "pass",
    live_import_gate: "closed",
    findings,
    counts,
    human_review_rows: humanReviewRows,
  };
  writeFileSync(path.join(outDir, "PROMOTION_READINESS.md"), renderMarkdown(report));
  return report;
}

export function main(argv = process.argv.slice(2)) {
  const report = verifyAtlasComponentImport(argv[0] ?? DEFAULT_IMPORT_DIR);
  console.log(JSON.stringify(report, null, 2));
  if (report.package_status === "fail") process.exitCode = 1;
}

const thisFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === path.resolve(thisFile)) {
  main();
}
