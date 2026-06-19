import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isInvokedPath, parseArgs, resolveSqlFiles } from "./apply-leadme-v2-sql.js";

function bmoPath(...parts: string[]): string {
  const root = [resolve("..", "BMO"), "C:\\BMO"].find((candidate) =>
    existsSync(resolve(candidate, "BARMATRIX", "engineering")),
  );
  return resolve(root ?? resolve("..", "BMO"), ...parts);
}

describe("apply LeadMe v2 SQL helpers", () => {
  it("recognizes direct invocation through the BMO api-repo junction", () => {
    assert.equal(
      isInvokedPath(
        "C:\\barmatrix-api\\src\\scripts\\apply-leadme-v2-sql.ts",
        "C:\\BMO\\api-repo\\src\\scripts\\apply-leadme-v2-sql.ts",
      ),
      true,
    );
  });

  it("defaults to dry-run against the sibling BMO SQL root", () => {
    const args = parseArgs([], "C:\\barmatrix-api");

    assert.equal(args.apply, false);
    assert.equal(args.sqlRoot, "C:\\BMO");
    assert.equal(args.includeSampleLoad, true);
  });

  it("defaults to the BMO SQL root from the api-repo junction", () => {
    const args = parseArgs([], "C:\\BMO\\api-repo");

    assert.equal(args.sqlRoot, "C:\\BMO");
  });

  it("includes the sample load only when present and requested", () => {
    const existing = new Set([
      "C:\\BMO\\BARMATRIX\\content-factory\\evidence\\load\\LOAD_EV-HS-003-BSREC-001.sql",
    ]);
    const files = resolveSqlFiles("C:\\BMO", true, (path) => existing.has(path));

    assert.equal(files.length, 4);
    assert.equal(resolveSqlFiles("C:\\BMO", false, () => true).length, 3);
  });

  it("applies schema patches after create DDL and before content loads", () => {
    const files = resolveSqlFiles("C:\\BMO", true, () => true);

    assert.equal(files.length, 4);
    assert.match(files[0] ?? "", /V2_CREATE_TABLES_MARIADB\.sql$/);
    assert.match(files[1] ?? "", /V2_SCHEMA_PATCHES_MARIADB\.sql$/);
    assert.match(files[2] ?? "", /V2_OUTLINE_ATLAS_LOAD\.sql$/);
  });

  it("creates migration tables in additive DDL without legacy capture inserts", () => {
    const ddl = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_CREATE_TABLES_MARIADB.sql"),
      "utf8",
    );

    assert.match(ddl, /CREATE TABLE IF NOT EXISTS question_id_migration/);
    assert.match(ddl, /CREATE TABLE IF NOT EXISTS answer_choice_id_migration/);
    assert.doesNotMatch(ddl, /INSERT INTO question_id_migration/);
    assert.doesNotMatch(ddl, /INSERT INTO answer_choice_id_migration/);
  });

  it("schema patches update existing v2 gate tables without content truncation", () => {
    const patchSql = readFileSync(
      bmoPath("BARMATRIX", "engineering", "V2_SCHEMA_PATCHES_MARIADB.sql"),
      "utf8",
    );

    assert.match(patchSql, /ADD COLUMN IF NOT EXISTS object_version/);
    assert.match(patchSql, /ADD COLUMN IF NOT EXISTS content_hash/);
    assert.match(patchSql, /ADD PRIMARY KEY \(object_id, object_type, object_version, content_hash, gate_name\)/);
    assert.doesNotMatch(patchSql, /TRUNCATE/i);
    assert.doesNotMatch(patchSql, /DROP TABLE/i);
    assert.doesNotMatch(patchSql, /DELETE FROM/i);
  });
});
