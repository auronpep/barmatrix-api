import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("dynamic CORS cache variance", () => {
  it("explicitly varies API responses by Origin before dynamic CORS runs", () => {
    const source = readFileSync(
      new URL("./index.ts", import.meta.url),
      "utf8",
    );

    const varyIndex = source.indexOf('res.vary("Origin")');
    const corsIndex = source.indexOf("cors({");

    assert.notEqual(varyIndex, -1);
    assert.notEqual(corsIndex, -1);
    assert.ok(varyIndex < corsIndex);
  });
});
