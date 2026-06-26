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

  it("gates customer Atlas_v1 routes behind paid enrollment", () => {
    const text = source("./atlas-v1.ts");

    assert.match(text, /requireEnrollment\(\)/);
    assert.match(text, /api\/atlas-v1/);
    assert.match(text, /q\.status = 'included'/);
    assert.match(text, /codes\/:code\/components/);
    assert.match(text, /readAtlasV1StudentComponents/);
    assert.doesNotMatch(text, /x-admin-secret/);
  });

  it("resolves auth before validating protected write route inputs", () => {
    assertBefore(
      after(source("./attempts.ts"), '"/api/attempts/:id/confusion"'),
      'const { userId } = getAuth(req);',
      'if (typeof id !== "string" || !UUID_RE.test(id))',
    );
    assertBefore(
      after(source("./path.ts"), '"/api/me/path/:stepId/complete"'),
      "resolveClerkStudent(req)",
      "const step = STEPS.find",
    );
    assertBefore(
      after(source("./flashcards.ts"), '"/api/me/flashcards/:deckId/complete"'),
      "resolveClerkStudent(req)",
      "const deck = getFlashcardDeck(deckId);",
    );
    assertBefore(
      after(source("./certification.ts"), '"/api/me/certification/:competencyId/start"'),
      "resolveClerkStudent(req)",
      "if (!isValidCompetencyId(id))",
    );
    assertBefore(
      after(source("./certification.ts"), '"/api/me/certification/:competencyId", clerkMiddleware()'),
      "resolveClerkStudent(req)",
      "if (!isValidCompetencyId(id))",
    );
    assertBefore(
      after(source("./student-debriefs.ts"), '"/api/me/debriefs/:qid/events"'),
      "resolveStudentId(req, res)",
      "const parsed = eventBody.safeParse",
    );
  });
});

function after(text: string, marker: string): string {
  const index = text.indexOf(marker);
  assert.notEqual(index, -1, `${marker} not found`);
  return text.slice(index);
}

function assertBefore(text: string, first: string, second: string): void {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  assert.notEqual(firstIndex, -1, `${first} not found`);
  assert.notEqual(secondIndex, -1, `${second} not found`);
  assert.ok(firstIndex < secondIndex, `${first} should appear before ${second}`);
}
