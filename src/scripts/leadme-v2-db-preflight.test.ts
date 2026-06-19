import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  PROMOTION_GATE_STATUS_COLUMN,
  REQUIRED_PROMOTION_GATES,
  REQUIRED_V2_TABLES,
  REVIEWED_DEBRIEF_ELEMENT_STATUSES,
  SERVABLE_QUEUE_STATUSES,
  STARTABLE_LEADME_STATUSES,
  STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES,
  formatPreflightError,
  isInvokedPath,
  missingDbEnv,
  missingNames,
} from "./leadme-v2-db-preflight.js";

function bmoPath(...parts: string[]): string {
  const root = [resolve("..", "BMO"), "C:\\BMO"].find((candidate) =>
    existsSync(resolve(candidate, "BARMATRIX", "engineering")),
  );
  return resolve(root ?? resolve("..", "BMO"), ...parts);
}

describe("LeadMe v2 DB preflight helpers", () => {
  it("recognizes direct invocation through the BMO api-repo junction", () => {
    assert.equal(
      isInvokedPath(
        "C:\\barmatrix-api\\src\\scripts\\leadme-v2-db-preflight.ts",
        "C:\\BMO\\api-repo\\src\\scripts\\leadme-v2-db-preflight.ts",
      ),
      true,
    );
  });

  it("reports only DB connection env and never requires Stripe or Clerk", () => {
    assert.deepEqual(missingDbEnv({}), [
      "DATABASE_HOST",
      "DATABASE_NAME",
      "DATABASE_USER",
      "BARMATRIX_DB_KEY or DATABASE_PASSWORD",
    ]);

    assert.deepEqual(
      missingDbEnv({
        DATABASE_HOST: "db.example",
        DATABASE_NAME: "app",
        DATABASE_USER: "app_user",
        BARMATRIX_DB_KEY: "secret",
      }),
      [],
    );
  });

  it("identifies unapplied v2 tables", () => {
    assert.ok(REQUIRED_V2_TABLES.includes("outline_nodes"));
    assert.deepEqual(
      missingNames(REQUIRED_V2_TABLES, ["leadme_items", "leadme_submissions"]),
      REQUIRED_V2_TABLES.filter(
        (name) => name !== "leadme_items" && name !== "leadme_submissions",
      ),
    );
  });

  it("prints a useful message for blank connection errors", () => {
    assert.equal(
      formatPreflightError(new Error("")),
      "LeadMe v2 DB preflight failed; check DB env and network reachability",
    );
  });

  it("uses the promotion gate status column defined by v2 DDL", () => {
    const ddl = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_CREATE_TABLES_MARIADB.sql"),
      "utf8",
    );

    assert.match(ddl, new RegExp(`${PROMOTION_GATE_STATUS_COLUMN} VARCHAR\\(64\\) NOT NULL`));
    assert.match(ddl, /object_version VARCHAR\(64\) NOT NULL/);
    assert.match(ddl, /content_hash VARCHAR\(128\) NOT NULL/);
    assert.match(ddl, /PRIMARY KEY \(object_id, object_type, object_version, content_hash, gate_name\)/);
    assert.equal(PROMOTION_GATE_STATUS_COLUMN, "gate_status");
  });

  it("checks the compiler's required release gates before startable content can pass preflight", () => {
    const compiler = readFileSync(
      bmoPath("scripts", "v2_sql_compiler.py"),
      "utf8",
    );
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.deepEqual(REQUIRED_PROMOTION_GATES, [
      "schema_valid",
      "outline_code_valid",
      "signals_not_deltas",
      "christian_theming_audit",
      "no_answer_leakage",
      "doctrine_gate",
      "legal_review",
    ]);
    for (const gate of REQUIRED_PROMOTION_GATES) {
      assert.match(compiler, new RegExp(`"${gate}"`));
      assert.match(verifySql, new RegExp(`'${gate}'`));
    }
    assert.match(compiler, /object_version, content_hash, gate_name, gate_status/);
    assert.match(preflight, /g\.object_version = li\.version/);
    assert.match(preflight, /g\.content_hash = li\.content_hash/);
    assert.match(verifySql, /g\.object_version = li\.version/);
    assert.match(verifySql, /g\.content_hash = li\.content_hash/);
    assert.match(preflight, /promotion_gate_release_findings/);
    assert.match(preflight, /li\.status IN \(\$\{placeholders\(STARTABLE_LEADME_STATUSES\)\}\)/);
    for (const status of STARTABLE_LEADME_STATUSES) {
      assert.match(verifySql, new RegExp(`'${status}'`));
    }
    assert.match(preflight, /COALESCE\(g\.\$\{PROMOTION_GATE_STATUS_COLUMN\}, 'missing'\) <> 'passed'/);
    assert.match(verifySql, /startable_leadme_items_with_unpassed_required_gates/);
    assert.doesNotMatch(verifySql, /gate_count < 7/);
  });

  it("fails student-visible debrief intel that is not reviewed", () => {
    const service = readFileSync(resolve("src", "lib", "leadme-debrief-service.ts"), "utf8");
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.deepEqual(STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES, ["active", "core"]);
    assert.deepEqual(REVIEWED_DEBRIEF_ELEMENT_STATUSES, [
      "approved",
      "reviewed",
      "legal_reviewed",
      "active",
    ]);
    for (const status of STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES) {
      assert.match(service, new RegExp(`"${status}"`));
      assert.match(verifySql, new RegExp(`'${status}'`));
    }
    for (const status of REVIEWED_DEBRIEF_ELEMENT_STATUSES) {
      assert.match(service, new RegExp(`"${status}"`));
      assert.match(verifySql, new RegExp(`'${status}'`));
    }
    assert.match(preflight, /debrief_element_release_findings/);
    assert.match(verifySql, /student_visible_debrief_elements_without_review/);
  });

  it("fails startable LeadMe sets with missing or non-startable entries", () => {
    const runtimeStore = readFileSync(resolve("src", "lib", "leadme-runtime-store.ts"), "utf8");
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.deepEqual(STARTABLE_LEADME_STATUSES, ["active", "published"]);
    for (const status of STARTABLE_LEADME_STATUSES) {
      assert.match(runtimeStore, new RegExp(`'${status}'`));
      assert.match(verifySql, new RegExp(`'${status}'`));
    }
    assert.match(preflight, /leadme_set_release_findings/);
    assert.match(verifySql, /startable_leadme_sets_with_bad_entries/);
    assert.match(verifySql, /set_has_no_entries/);
    assert.match(verifySql, /entry_item_missing/);
    assert.match(verifySql, /entry_item_not_startable/);
  });

  it("fails startable LeadMe items without compiled front or server payloads", () => {
    const currentService = readFileSync(
      resolve("src", "lib", "leadme-current-service.ts"),
      "utf8",
    );
    const submitService = readFileSync(
      resolve("src", "lib", "leadme-submit-service.ts"),
      "utf8",
    );
    const compiler = readFileSync(
      bmoPath("scripts", "v2_sql_compiler.py"),
      "utf8",
    );
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );
    const findings = [
      "missing_front_payload",
      "missing_content_hash",
      "missing_server_payload",
      "missing_submit_private",
      "missing_branch_private",
      "missing_scoring_signal",
      "missing_server_payload_hash",
    ];

    assert.match(currentService, /compiled_json_text/);
    assert.match(currentService, /leadme_compiled_payloads/);
    assert.match(submitService, /JOIN leadme_compiled_payloads/);
    assert.match(compiler, /INSERT INTO leadme_compiled_payloads/);
    assert.match(compiler, /scoring_signal_json/);
    assert.match(preflight, /leadme_item_payload_release_findings/);
    assert.match(verifySql, /startable_leadme_items_missing_payloads/);
    for (const finding of findings) {
      assert.match(preflight, new RegExp(finding));
      assert.match(verifySql, new RegExp(finding));
    }
  });

  it("fails servable queue entries whose item version/hash no longer resolves", () => {
    const currentService = readFileSync(
      resolve("src", "lib", "leadme-current-service.ts"),
      "utf8",
    );
    const runtimeStore = readFileSync(resolve("src", "lib", "leadme-runtime-store.ts"), "utf8");
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.deepEqual(SERVABLE_QUEUE_STATUSES, ["available", "served", "viewed", "started"]);
    assert.match(currentService, /item_id = \$1 AND version = \$2 AND content_hash = \$3/);
    assert.match(runtimeStore, /set_id, item_id, item_version, content_hash, status/);
    assert.match(preflight, /leadme_queue_release_findings/);
    assert.match(preflight, /SERVABLE_QUEUE_STATUSES/);
    assert.match(verifySql, /servable_leadme_queue_entries_with_bad_items/);
    assert.match(verifySql, /q\.content_hash/);
    assert.match(verifySql, /queue_missing_content_hash/);
    assert.match(verifySql, /queue_item_missing/);
    assert.match(verifySql, /queue_item_not_startable/);
  });

  it("fails active Outline Atlas attachments with missing or unsafe targets", () => {
    const outlineAtlas = readFileSync(resolve("src", "lib", "outline-atlas.ts"), "utf8");
    const outlineSqlEmitter = readFileSync(
      bmoPath("scripts", "v2_outline_atlas_sql.py"),
      "utf8",
    );
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.match(outlineAtlas, /status IN \('active', 'published'\)/);
    assert.match(outlineSqlEmitter, /"attachment_type": "leadme_item"/);
    assert.match(outlineSqlEmitter, /"attachment_type": "debrief_element"/);
    assert.match(preflight, /outline_attachment_release_findings/);
    assert.match(verifySql, /active_outline_attachments_with_bad_targets/);
    assert.match(verifySql, /leadme_item_missing/);
    assert.match(verifySql, /leadme_item_not_startable/);
    assert.match(verifySql, /debrief_element_missing/);
    assert.match(verifySql, /debrief_element_not_student_safe/);
    assert.match(verifySql, /unsupported_attachment_type/);
  });

  it("ignores soft-FK legacy attempt rows in orphan checks", () => {
    const preflight = readFileSync(resolve("src", "scripts", "leadme-v2-db-preflight.ts"), "utf8");
    const verifySql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_VERIFY.sql"),
      "utf8",
    );

    assert.match(preflight, /COALESCE\(a\.is_legacy, 0\) = 0/);
    assert.match(verifySql, /COALESCE\(sa\.is_legacy, 0\) = 0/);
    assert.match(verifySql, /student_attempt_nonlegacy_question_orphans/);
    assert.match(verifySql, /student_attempt_nonlegacy_choice_orphans/);
  });
});
