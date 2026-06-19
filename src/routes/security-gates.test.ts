import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("sensitive route gates", () => {
  it("gates answer-key data behind Clerk enrollment", () => {
    const text = source("./answer-key.ts");

    assert.match(text, /clerkMiddleware\(\)/);
    assert.match(text, /resolveClerkStudent\(req\)/);
    assert.match(text, /enrollment required/);
  });

  it("derives red-zone ownership from Clerk instead of query student_id", () => {
    const text = source("./red-zones.ts");

    assert.match(text, /clerkMiddleware\(\)/);
    assert.match(text, /resolveClerkStudent\(req\)/);
    assert.doesNotMatch(text, /req\.query\.student_id/);
  });

  it("gates debrief intelligence behind Clerk enrollment", () => {
    const text = source("./debrief-intel.ts");

    assert.match(text, /clerkMiddleware\(\)/);
    assert.match(text, /requireEnrolled\(req, res\)/);
    assert.match(text, /enrollment required/);
  });

  it("gates Atlas_v1 admin routes behind ADMIN_SECRET", () => {
    const text = source("./admin-atlas-v1.ts");

    assert.match(text, /ADMIN_SECRET/);
    assert.match(text, /x-admin-secret/);
    assert.match(text, /api\/admin\/atlas-v1/);
  });
});
