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
  recordDiagnosticLead,
  diagnosticLeadBody,
  diagnosticLeadMetadata,
} = await import("./diagnostic-leads.js");

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

describe("diagnosticLeadBody", () => {
  it("normalizes email and optional fields", () => {
    const parsed = diagnosticLeadBody.parse({
      email: "  Student@Example.COM ",
      diagnostic_id: " 11111111-2222-3333-4444-555555555555 ",
      full_name: "  Sunny Student ",
      jurisdiction: "",
      source_page: "/diagnostic/results",
    });

    assert.equal(parsed.email, "student@example.com");
    assert.equal(parsed.diagnostic_id, "11111111-2222-3333-4444-555555555555");
    assert.equal(parsed.full_name, "Sunny Student");
    assert.equal(parsed.jurisdiction, null);
  });

  it("stays lenient on a malformed diagnostic_id so the email is never dropped", () => {
    const parsed = diagnosticLeadBody.parse({
      email: "student@example.com",
      diagnostic_id: "not-a-uuid",
    });
    assert.equal(parsed.diagnostic_id, "not-a-uuid");
  });

  it("captures lead metadata with the diagnostic id", () => {
    const parsed = diagnosticLeadBody.parse({
      email: "student@example.com",
      diagnostic_id: "11111111-2222-3333-4444-555555555555",
      source_page: "/diagnostic/results",
    });
    const metadata = JSON.parse(diagnosticLeadMetadata(parsed));

    assert.equal(metadata.lead_type, "diagnostic_results");
    assert.equal(metadata.diagnostic_id, "11111111-2222-3333-4444-555555555555");
    assert.equal(metadata.captured_via, "/diagnostic/results");
  });
});

describe("recordDiagnosticLead", () => {
  it("creates the table if needed and stores a new diagnostic lead", async () => {
    const { calls, db } = mockDb(1);
    const result = await recordDiagnosticLead(
      diagnosticLeadBody.parse({
        email: "student@example.com",
        diagnostic_id: "11111111-2222-3333-4444-555555555555",
        source_page: "/diagnostic/results",
        utm_source: "instagram",
        utm_campaign: "ambassador",
      }),
      db,
    );

    assert.equal(result.ok, true);
    assert.equal(result.lead_id, "lead-123");
    assert.equal(result.status, "created");
    assert.match(calls[0]?.sql ?? "", /CREATE TABLE IF NOT EXISTS diagnostic_leads/);
    assert.match(calls[1]?.sql ?? "", /INSERT INTO diagnostic_leads/);
    assert.equal(calls[1]?.values[0], "diagnostic_results");
    assert.equal(calls[1]?.values[1], "student@example.com");
    assert.equal(calls[1]?.values[2], "11111111-2222-3333-4444-555555555555");
    assert.equal(calls[1]?.values[6], "instagram");
  });

  it("updates an existing lead", async () => {
    const { db } = mockDb(2);
    const result = await recordDiagnosticLead(
      diagnosticLeadBody.parse({
        email: "student@example.com",
        diagnostic_id: "11111111-2222-3333-4444-555555555555",
      }),
      db,
    );

    assert.equal(result.status, "updated");
    assert.match(result.message, /red-zone map is saved/);
  });

  it("ignores honeypot submissions without touching storage", async () => {
    const { calls, db } = mockDb(1);
    const result = await recordDiagnosticLead(
      diagnosticLeadBody.parse({
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
