import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildAtlasComponentProjection,
  parseAtlasComponentPacket,
  writeAtlasComponentProjection,
} from "./generate-atlas-component-import.js";
import {
  isReadOnlySql,
  splitSqlStatements,
} from "./run-atlas-component-db-preflight.js";
import {
  parseArgs as parseApplyAtlasComponentImportArgs,
  resolveImportSqlFile,
} from "./apply-atlas-component-import.js";
import {
  extractAtlasCodesFromSql,
  verifyAtlasComponentImport,
} from "./verify-atlas-component-import.js";

const packetMarkdown = `\`\`\`yaml
packet:
  packet_metadata:
    packet_id: TEST-01
    packet_verdict: READY
  target_input_echo:
    subject: Evidence
    subject_enum: EVIDENCE
    subject_display: Evidence Law
    subtopic: Presentation of Evidence
    outline_code: "31010101"
  node_scope_summary:
    node_title: Roles of judge and jury
\`\`\`

## component_bridge_json

\`\`\`json
{
  "component_bridge_version": "v4",
  "outline_code": "31010101"
}
\`\`\`

## ingestion_rows_json

\`\`\`json
{
  "canonical_axes": [
    {
      "axis_id": "AX-1",
      "axis_name": "Judge gate vs jury weight",
      "red_zone_id": "RZ-01",
      "method_class": "anchor_assisted"
    }
  ],
  "axis_choice_patterns": [
    {
      "choice_pattern_id": "CP-1",
      "axis_id": "AX-1",
      "filter_broken": "NOT_TRUE",
      "mold_code": "overclaim"
    }
  ],
  "prototype_answer_arrays": [],
  "gold_keys": [
    { "key_id": "GK-1", "title": "FRE 104 gate", "type": "rule" }
  ],
  "silver_keys": [],
  "drill_seeds": [
    {
      "drill_id": "DR-1",
      "outline_code": "31010101",
      "axis_ids": ["AX-1"],
      "prompt": "Sort judge and jury roles."
    }
  ],
  "component_payload_rows": [
    { "component": "tension_map", "status": "ready" },
    { "component_target": "drill_library", "status": "ready" }
  ],
  "question_mapping_template_rows": [
    {
      "outline_code": "31010101",
      "subject": "EVIDENCE",
      "mapping_confidence": "high",
      "question_mapping_status": "candidate_mapping"
    }
  ],
  "human_review_rows": []
}
\`\`\`
`;

describe("Atlas component packet import", () => {
  it("parses packet metadata and the structured JSON blocks", () => {
    const packet = parseAtlasComponentPacket(packetMarkdown, "31010101.md");

    assert.equal(packet.outline_code, "31010101");
    assert.equal(packet.packet_id, "TEST-01");
    assert.equal(packet.subject_enum, "EVIDENCE");
    assert.equal(packet.warnings.length, 0);
  });

  it("normalizes component and component_target rows into one component target count", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-component-import-"));
    writeFileSync(path.join(dir, "31010101.md"), packetMarkdown);

    const result = buildAtlasComponentProjection(dir);

    assert.equal(result.summary.files_found, 1);
    assert.equal(result.summary.packets_parsed, 1);
    assert.deepEqual(result.summary.component_target_counts, {
      drill_library: 1,
      tension_map: 1,
    });
    assert.equal(result.projection.debrief_elements.length, 3);
    assert.equal(result.projection.leadme_items.length, 1);
    assert.equal(result.projection.leadme_compiled_payloads.length, 1);
    assert.equal(result.projection.leadme_sets.length, 1);
    assert.match(
      String(result.projection.leadme_compiled_payloads[0]?.compiled_server_payload_hash),
      /^sha256:/,
    );
  });

  it("verifies the local import package has matching runtime payload rows", () => {
    const sourceDir = mkdtempSync(path.join(tmpdir(), "atlas-component-import-source-"));
    const outDir = mkdtempSync(path.join(tmpdir(), "atlas-component-import-out-"));
    writeFileSync(path.join(sourceDir, "31010101.md"), packetMarkdown);
    writeAtlasComponentProjection(buildAtlasComponentProjection(sourceDir), outDir);

    const report = verifyAtlasComponentImport(outDir);
    const preflightSql = readFileSync(
      path.join(outDir, "PREFLIGHT_ATLAS_COMPONENT_IMPORT.sql"),
      "utf8",
    );
    assert.equal(report.package_status, "pass");
    assert.equal(report.live_import_gate, "closed");
    assert.match(
      report.findings.map((finding) => finding.message).join("\n"),
      /every LeadMe item has a compiled payload row/,
    );
    assert.match(preflightSql, /candidate_outline_nodes/);
    assert.doesNotMatch(preflightSql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|REPLACE)\b/i);
  });

  it("writes an unblocked SQL subset when human review rows exist", () => {
    const sourceDir = mkdtempSync(path.join(tmpdir(), "atlas-component-import-source-"));
    const outDir = mkdtempSync(path.join(tmpdir(), "atlas-component-import-out-"));
    const blockedPacket = packetMarkdown.replace(
      '"human_review_rows": []',
      `"human_review_rows": [
    {
      "flag_id": "HR-test",
      "reason": "Needs human legal review.",
      "required_review": "Keep blocked before promotion."
    }
  ]`,
    );
    writeFileSync(path.join(sourceDir, "31010101.md"), blockedPacket);
    writeFileSync(
      path.join(sourceDir, "31010102.md"),
      packetMarkdown.replaceAll("31010101", "31010102").replaceAll("TEST-01", "TEST-02"),
    );
    writeAtlasComponentProjection(buildAtlasComponentProjection(sourceDir), outDir);
    writeFileSync(path.join(outDir, "HUMAN_REVIEW_NOTES.md"), "Keep blocked.");

    const report = verifyAtlasComponentImport(outDir);
    const unblockedSql = readFileSync(
      path.join(outDir, "LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql"),
      "utf8",
    );
    const rollbackSql = readFileSync(
      path.join(outDir, "ROLLBACK_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql"),
      "utf8",
    );
    const promotionSql = readFileSync(
      path.join(outDir, "PROMOTE_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql"),
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync(path.join(outDir, "PROMOTION_SUBSET_MANIFEST.json"), "utf8"),
    );
    const localAtlasCodePreflight = JSON.parse(
      readFileSync(path.join(outDir, "LOCAL_ATLAS_CODE_PREFLIGHT.json"), "utf8"),
    );
    const preflightSql = readFileSync(
      path.join(outDir, "PREFLIGHT_ATLAS_COMPONENT_IMPORT.sql"),
      "utf8",
    );
    const readinessMarkdown = readFileSync(path.join(outDir, "PROMOTION_READINESS.md"), "utf8");

    assert.equal(report.package_status, "pass");
    assert.match(
      report.findings.map((finding) => finding.message).join("\n"),
      /unblocked candidate SQL excludes blocked outline codes and packet ids/,
    );
    assert.doesNotMatch(unblockedSql, /31010101|TEST-01/);
    assert.match(rollbackSql, /DELETE FROM debrief_elements/);
    assert.doesNotMatch(rollbackSql, /31010101|TEST-01/);
    assert.match(String(manifest.unblocked_sql_sha256), /^sha256:/);
    assert.match(String(manifest.rollback_sql_sha256), /^sha256:/);
    assert.equal(manifest.student_visible_promotion_sql, "PROMOTE_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql");
    assert.match(String(manifest.student_visible_promotion_sql_sha256), /^sha256:/);
    assert.equal(manifest.local_atlas_code_preflight, "LOCAL_ATLAS_CODE_PREFLIGHT.json");
    assert.match(String(localAtlasCodePreflight.status), /^(pass|not_run)$/);
    assert.equal(localAtlasCodePreflight.coverage_scope, "local_v2_outline_nodes_load");
    assert.equal(localAtlasCodePreflight.local_source_table, "outline_nodes");
    assert.equal(localAtlasCodePreflight.api_runtime_table, "atlas_outline_nodes");
    assert.equal(localAtlasCodePreflight.db_preflight_required_for_api_table, true);
    assert.match(
      report.findings.map((finding) => finding.message).join("\n"),
      /live atlas_outline_nodes coverage requires DB preflight/,
    );
    assert.match(promotionSql, /UPDATE leadme_items/);
    assert.match(promotionSql, /COALESCE\(g\.gate_status, 'missing'\) <> 'passed'/);
    assert.doesNotMatch(promotionSql, /31010101|TEST-01/);
    assert.match(readinessMarkdown, /apply-atlas-component-import\.ts --phase promotion --apply/);
    assert.match(preflightSql, /blocked_outline_attachment_rows/);
    assert.doesNotMatch(preflightSql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|REPLACE)\b/i);
  });

  it("extracts local Atlas load codes from SQL string literals", () => {
    assert.deepEqual(
      extractAtlasCodesFromSql("VALUES ('31010101', 'x'), ('31010101', 'x'), ('35030203', 'x');"),
      ["31010101", "35030203"],
    );
  });

  it("keeps the DB preflight runner read-only", () => {
    assert.deepEqual(splitSqlStatements("SELECT 1;\nSELECT 2;\n"), ["SELECT 1", "SELECT 2"]);
    assert.equal(isReadOnlySql("-- INSERT ignored in a comment\nSELECT 1;"), true);
    assert.equal(isReadOnlySql("SELECT 1; UPDATE leadme_items SET status = 'active';"), false);
  });

  it("keeps Atlas component import application dry-run by default", () => {
    const args = parseApplyAtlasComponentImportArgs([]);

    assert.equal(args.apply, false);
    assert.equal(args.phase, "candidate");
    assert.match(resolveImportSqlFile(args.importDir), /LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED\.sql$/);
    assert.match(
      resolveImportSqlFile(args.importDir, "promotion"),
      /PROMOTE_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED\.sql$/,
    );
    assert.equal(parseApplyAtlasComponentImportArgs(["--phase", "promotion"]).phase, "promotion");
  });
});
