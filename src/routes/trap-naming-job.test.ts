import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult } from "../db.js";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
process.env.BARMATRIX_DB_KEY = "test_password";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP = "prod_placeholder";
process.env.STRIPE_PRICE_PAY_IN_FULL = "price_placeholder_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR = "price_placeholder_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO = "price_placeholder_two";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND = "price_placeholder_second";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const { runTrapNamingJob } = await import("./trap-naming-job.js");

type Call = { sql: string; values: readonly unknown[] };

function mockDb(leads: unknown[]) {
  const calls: Call[] = [];
  return {
    calls,
    db: {
      query: async <T>(
        sql: string,
        values: readonly unknown[] = [],
      ): Promise<QueryResult<T>> => {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT lead_id")) {
          return { rows: leads as T[], rowCount: leads.length };
        }
        return { rows: [], rowCount: 1 };
      },
    },
  };
}

const LEAD = {
  lead_id: "L1",
  email: "student@example.com",
  diagnostic_id: "d-1",
  full_name: null,
};
const TRAP = {
  trapName: "Bait Doctrine",
  trapSubject: "Civil Procedure",
  rule: "A valid FRCP on point controls.",
};

describe("runTrapNamingJob", () => {
  it("dry-run reports would_send and sends nothing", async () => {
    const { calls, db } = mockDb([LEAD]);
    let sends = 0;
    const summary = await runTrapNamingJob({
      send: false,
      db,
      loadTrap: async () => TRAP,
      sendEmail: async () => {
        sends += 1;
        return { status: "sent", id: "x" };
      },
    });
    assert.equal(summary.eligible, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.items[0]?.outcome, "would_send");
    assert.equal(sends, 0);
    assert.ok(!calls.some((c) => c.sql.startsWith("UPDATE")));
  });

  it("skips a lead with no trap or rule, without sending", async () => {
    const { calls, db } = mockDb([LEAD]);
    let sends = 0;
    const summary = await runTrapNamingJob({
      send: true,
      db,
      loadTrap: async () => ({ trapName: null, trapSubject: null, rule: null }),
      sendEmail: async () => {
        sends += 1;
        return { status: "sent", id: "x" };
      },
    });
    assert.equal(summary.skipped, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.items[0]?.outcome, "skipped");
    assert.equal(summary.items[0]?.reason, "missing_trap_or_rule");
    assert.equal(sends, 0);
    assert.ok(!calls.some((c) => c.sql.startsWith("UPDATE")));
  });

  it("sends and marks the lead when a trap + rule resolve", async () => {
    const { calls, db } = mockDb([LEAD]);
    const sentInputs: unknown[] = [];
    const summary = await runTrapNamingJob({
      send: true,
      db,
      loadTrap: async () => TRAP,
      sendEmail: async (input) => {
        sentInputs.push(input);
        return { status: "sent", id: "email_1" };
      },
    });
    assert.equal(summary.sent, 1);
    assert.equal(summary.items[0]?.outcome, "sent");
    assert.equal(sentInputs.length, 1);
    const update = calls.find((c) =>
      c.sql.startsWith("UPDATE diagnostic_leads SET trap_email_sent_at"),
    );
    assert.ok(update, "expected the lead to be marked sent");
    assert.deepEqual(update?.values, ["L1"]);
    // email is masked in the report
    assert.equal(summary.items[0]?.email, "s***@example.com");
  });

  it("does not mark the lead sent if the email send is skipped", async () => {
    const { calls, db } = mockDb([LEAD]);
    const summary = await runTrapNamingJob({
      send: true,
      db,
      loadTrap: async () => TRAP,
      sendEmail: async () => ({ status: "skipped", reason: "missing_config" }),
    });
    assert.equal(summary.sent, 0);
    assert.equal(summary.skipped, 1);
    assert.ok(!calls.some((c) => c.sql.startsWith("UPDATE")));
  });
});
