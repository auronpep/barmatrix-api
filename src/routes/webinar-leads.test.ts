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

const {
  recordWebinarLead,
  webinarLeadBody,
  webinarLeadMetadata,
} = await import("./webinar-leads.js");

type Call = { sql: string; values: readonly unknown[] };

function mockDb(insertRowCount = 1) {
  const calls: Call[] = [];
  return {
    calls,
    db: {
      query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT lead_id")) {
          return {
            rows: [{ lead_id: "lead-123" } as T],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: sql.startsWith("INSERT INTO") ? insertRowCount : 0 };
      },
    },
  };
}

describe("webinarLeadBody", () => {
  it("normalizes email and optional fields", () => {
    const parsed = webinarLeadBody.parse({
      email: "  Student@Example.COM ",
      full_name: "  Sunny Student ",
      role: "",
      jurisdiction: " California ",
      source_page: "/webinar",
    });

    assert.equal(parsed.email, "student@example.com");
    assert.equal(parsed.full_name, "Sunny Student");
    assert.equal(parsed.role, null);
    assert.equal(parsed.jurisdiction, "California");
  });

  it("keeps explicit no-autoresponder metadata", () => {
    const parsed = webinarLeadBody.parse({
      email: "student@example.com",
      source_page: "/webinar",
    });
    const metadata = JSON.parse(webinarLeadMetadata(parsed));

    assert.equal(metadata.lead_type, "webinar_next_session");
    assert.equal(metadata.consent.next_session_notice, true);
    assert.equal(metadata.consent.no_autoresponder, true);
  });
});

describe("recordWebinarLead", () => {
  it("creates the table if needed and stores a new next-session lead", async () => {
    const { calls, db } = mockDb(1);
    const result = await recordWebinarLead(
      webinarLeadBody.parse({
        email: "student@example.com",
        full_name: "Student Name",
        role: "Repeat taker",
        jurisdiction: "CA",
        exam_window: "July 2026",
        context: "Interested in the hearsay webinar.",
        source_page: "/webinar",
        utm_source: "reddit",
        utm_campaign: "same_day",
      }),
      db,
    );

    assert.equal(result.ok, true);
    assert.equal(result.lead_id, "lead-123");
    assert.equal(result.status, "created");
    assert.match(calls[0]?.sql ?? "", /CREATE TABLE IF NOT EXISTS webinar_leads/);
    assert.match(calls[1]?.sql ?? "", /INSERT INTO webinar_leads/);
    assert.equal(calls[1]?.values[0], "webinar_next_session");
    assert.equal(calls[1]?.values[1], "student@example.com");
    assert.equal(calls[1]?.values[8], "reddit");
    assert.match(calls[1]?.sql ?? "", /email_sent_at = NULL/);
  });

  it("updates an existing lead without sending anything", async () => {
    const { db } = mockDb(2);
    const result = await recordWebinarLead(
      webinarLeadBody.parse({
        email: "student@example.com",
        context: "Updated context",
      }),
      db,
    );

    assert.equal(result.status, "updated");
    assert.match(result.message, /No automated email was sent/);
  });

  it("ignores honeypot submissions without touching storage", async () => {
    const { calls, db } = mockDb(1);
    const result = await recordWebinarLead(
      webinarLeadBody.parse({
        email: "bot@example.com",
        website: "https://spam.invalid",
      }),
      db,
    );

    assert.equal(result.status, "ignored");
    assert.equal(result.lead_id, null);
    assert.equal(calls.length, 0);
  });
});
