import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "./db.js";

process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
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
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const { resolveOwnedBillingPortalCustomer } = await import(
  "./lib/clerk-entitlement.js"
);

type QueryCall = {
  sql: string;
  values: readonly unknown[] | undefined;
};

function mockDb(rows: unknown[]) {
  const calls: QueryCall[] = [];
  const db: Pick<DbPool, "query"> = {
    async query<T = unknown>(
      sql: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>> {
      calls.push({ sql, values });
      return { rows: rows as T[], rowCount: rows.length };
    },
  };
  return {
    calls,
    db,
  };
}

describe("resolveOwnedBillingPortalCustomer", () => {
  it("fails closed when the billing portal caller is unauthenticated", async () => {
    const { db, calls } = mockDb([
      {
        purchase_id: "purchase_owned",
        student_id: "student_owner",
        stripe_customer_id: "cus_owned",
        entitlement_status: "active",
        refund_status: "none",
      },
    ]);

    const result = await resolveOwnedBillingPortalCustomer(
      {
        studentId: null,
        checkoutSessionId: "cs_test_owned",
      },
      db,
    );

    assert.deepEqual(result, { status: "unauthenticated" });
    assert.equal(calls.length, 0);
  });

  it("rejects a checkout session that belongs to another student", async () => {
    const { db } = mockDb([
      {
        purchase_id: "purchase_other",
        student_id: "student_other",
        stripe_customer_id: "cus_other",
        entitlement_status: "active",
        refund_status: "none",
      },
    ]);

    const result = await resolveOwnedBillingPortalCustomer(
      {
        studentId: "student_owner",
        checkoutSessionId: "cs_test_other",
      },
      db,
    );

    assert.deepEqual(result, { status: "forbidden" });
  });

  it("fails closed when no local purchase proves the checkout session", async () => {
    const { db } = mockDb([]);

    const result = await resolveOwnedBillingPortalCustomer(
      {
        studentId: "student_owner",
        checkoutSessionId: "cs_test_missing",
      },
      db,
    );

    assert.deepEqual(result, { status: "not_found" });
  });

  it("returns the Stripe customer only when the local purchase belongs to the owner", async () => {
    const { db, calls } = mockDb([
      {
        purchase_id: "purchase_owned",
        student_id: "student_owner",
        stripe_customer_id: "cus_owned",
        entitlement_status: "active",
        refund_status: "none",
      },
    ]);

    const result = await resolveOwnedBillingPortalCustomer(
      {
        studentId: "student_owner",
        checkoutSessionId: "cs_test_owned",
      },
      db,
    );

    assert.deepEqual(result, {
      status: "ok",
      customerId: "cus_owned",
      purchaseId: "purchase_owned",
    });
    assert.match(calls[0]?.sql ?? "", /stripe_checkout_session_id = \$1/);
    assert.deepEqual(calls[0]?.values, ["cs_test_owned"]);
  });

  it("recovers a missing billing customer from an active owned checkout session", async () => {
    const { db, calls } = mockDb([
      {
        purchase_id: "purchase_owned",
        student_id: "student_owner",
        stripe_customer_id: null,
        stripe_checkout_session_id: "cs_test_owned",
        entitlement_status: "active",
        refund_status: "none",
      },
    ]);
    const recoveries: Array<{
      purchaseId: string;
      checkoutSessionId: string | null;
    }> = [];

    const result = await resolveOwnedBillingPortalCustomer(
      {
        studentId: "student_owner",
      },
      db,
      async (purchase) => {
        recoveries.push(purchase);
        return "cus_recovered";
      },
    );

    assert.deepEqual(result, {
      status: "ok",
      customerId: "cus_recovered",
      purchaseId: "purchase_owned",
    });
    assert.equal(recoveries.length, 1);
    assert.deepEqual(recoveries[0], {
      purchaseId: "purchase_owned",
      checkoutSessionId: "cs_test_owned",
    });
    assert.match(calls[0]?.sql ?? "", /student_id = \$1/);
    assert.doesNotMatch(
      calls[0]?.sql ?? "",
      /AND\s+stripe_customer_id IS NOT NULL/,
    );
  });
});
