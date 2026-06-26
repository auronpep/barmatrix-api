import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./me-confusion.ts", import.meta.url), "utf8");

describe("GET /api/me/confusion SQL", () => {
  it("collates optional confusion IDs to the core table collation before joining", () => {
    assert.match(
      source,
      /t\.attempt_id\s+COLLATE\s+utf8mb4_unicode_ci\s+=\s+a\.attempt_id/,
    );
    assert.match(
      source,
      /t\.choice_id\s+COLLATE\s+utf8mb4_unicode_ci\s+=\s+ac\.choice_id/,
    );
    assert.match(
      source,
      /t\.question_id\s+COLLATE\s+utf8mb4_unicode_ci\s+=\s+q\.question_id/,
    );
  });
});
