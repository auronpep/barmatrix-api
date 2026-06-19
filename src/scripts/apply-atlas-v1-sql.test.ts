import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isInvokedPath, parseArgs, resolveSqlFiles } from "./apply-atlas-v1-sql.js";

describe("apply Atlas_v1 SQL helpers", () => {
  it("recognizes direct invocation through the BMO api-repo junction", () => {
    assert.equal(
      isInvokedPath(
        "C:\\barmatrix-api\\src\\scripts\\apply-atlas-v1-sql.ts",
        "C:\\BMO\\api-repo\\src\\scripts\\apply-atlas-v1-sql.ts",
      ),
      true,
    );
  });

  it("defaults to dry-run against the sibling BMO SQL root", () => {
    const args = parseArgs([], "C:\\barmatrix-api");

    assert.equal(args.apply, false);
    assert.equal(args.sqlRoot, "C:\\BMO");
  });

  it("applies core before the approved question load", () => {
    const files = resolveSqlFiles("C:\\BMO");

    assert.equal(files.length, 2);
    assert.match(files[0] ?? "", /ATLAS_V1_CORE_LOAD\.sql$/);
    assert.match(files[1] ?? "", /ATLAS_V1_QUESTION_LOAD\.sql$/);
  });

  it("finds the Atlas_v1 SQL files in the current worktree", () => {
    const worktree = resolve("C:\\BMO\\.claude\\worktrees\\atlas-v1-core");
    if (!existsSync(worktree)) return;

    const files = resolveSqlFiles(worktree);
    assert.equal(files.every((file) => existsSync(file)), true);
  });
});
