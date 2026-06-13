import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("checkout recovery account access", () => {
  it("sends the recovered checkout through the same Clerk access email path as webhooks", () => {
    const source = readFileSync("src/routes/me.ts", "utf8");

    assert.match(
      source,
      /import \{ sendEnrollmentEmailForFulfillment \} from "\.\.\/email\.js";/,
    );
    assert.match(
      source,
      /const result = await fulfillCheckoutSession\([\s\S]*?await sendEnrollmentEmailForFulfillment\(\{\s*session,\s*fulfillment: result,\s*\}\);[\s\S]*?res\.json\(/,
    );
  });
});
