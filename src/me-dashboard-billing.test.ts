import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("me dashboard billing portal capability", () => {
  it("includes billing portal capability in the dashboard payload", () => {
    const source = readFileSync(new URL("./routes/me.ts", import.meta.url), "utf8");

    assert.match(source, /billing_portal/);
    assert.match(source, /stripe_customer_id/);
    assert.match(source, /stripe_checkout_session_id/);
  });
});
