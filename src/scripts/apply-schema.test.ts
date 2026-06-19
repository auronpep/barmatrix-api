import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("apply-schema migration script", () => {
  it("falls back to BARMATRIX_DB_KEY when DATABASE_PASSWORD is empty", () => {
    const source = readFileSync(new URL("../../scripts/apply-schema.mjs", import.meta.url), "utf8");

    assert.match(source, /process\.env\.DATABASE_PASSWORD \|\| process\.env\.BARMATRIX_DB_KEY/);
  });
});
