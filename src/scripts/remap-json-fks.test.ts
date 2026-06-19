import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  missingDbEnv,
  remapDayQuestionIds,
  remapQuestionIdArray,
} from "./remap-json-fks.js";

describe("remap_json_fks helpers", () => {
  it("reports only DB connection env", () => {
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

  it("remaps flat question arrays in order and drops ids without a v2 target", () => {
    const map = new Map([
      ["old-a", "new-a"],
      ["old-b", "new-b"],
    ]);

    assert.deepEqual(
      remapQuestionIdArray(["old-a", "missing", "old-b", "old-a"], map),
      ["new-a", "new-b", "new-a"],
    );
  });

  it("remaps boot-camp day buckets without deleting the day keys", () => {
    const map = new Map([
      ["old-a", "new-a"],
      ["old-b", "new-b"],
    ]);

    assert.deepEqual(
      remapDayQuestionIds({
        "1": ["old-a", "missing"],
        "2": ["old-b"],
        mastery: "not-an-array",
      }, map),
      {
        "1": ["new-a"],
        "2": ["new-b"],
        mastery: [],
      },
    );
  });
});
