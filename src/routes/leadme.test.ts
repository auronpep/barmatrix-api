import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_NAME ??= "test";
process.env.DATABASE_USER ??= "test";
process.env.BARMATRIX_DB_KEY ??= "test";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_dummy";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP ??= "prod_dummy";
process.env.STRIPE_PRICE_PAY_IN_FULL ??= "price_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR ??= "price_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO ??= "price_two_first";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND ??= "price_two_second";
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_dummy";
process.env.CLERK_SECRET_KEY ??= "sk_test_dummy";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.SUCCESS_URL ??= "http://localhost:3000/success";
process.env.CANCEL_URL ??= "http://localhost:3000/cancel";

describe("LeadMe route response shaping", () => {
  it("publishes only student-safe submit fields", async () => {
    const { toLeadMeSubmitHttpResponse } = await import("./leadme.js");
    const response = toLeadMeSubmitHttpResponse({
      idempotent_replay: false,
      attempt_event_id: "att_1",
      debrief_focus: {
        auto_expand_sections: [],
        auto_expand_choices: [],
        elements: [],
      },
      scoring_summary: { signals_recorded: true },
      result: {
        correctness: "incorrect",
        branch_id: "BR-B-INTERNAL",
        selected_response: "B",
        back_blocks: [],
        next_action_summary: { type: "queued", label: "Repair card added" },
      },
    });

    assert.equal("branch_id" in response.leadme_result, false);
    assert.equal(response.leadme_result.next_action, "Repair card added");
  });
});
