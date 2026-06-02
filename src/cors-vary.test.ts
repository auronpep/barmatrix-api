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

  it("marks API responses no-store before dynamic CORS runs", () => {
    const source = readFileSync(
      new URL("./index.ts", import.meta.url),
      "utf8",
    );

    const noStoreIndex = source.indexOf('"Cache-Control", "no-store"');
    const corsIndex = source.indexOf("cors({");

    assert.notEqual(noStoreIndex, -1);
    assert.notEqual(corsIndex, -1);
    assert.ok(noStoreIndex < corsIndex);
  });
});
