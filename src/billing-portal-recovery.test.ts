import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const { recoverBillingCustomerFromCheckoutSession } = await import(
  "./lib/billing-portal.js"
);

type QueryCall = {
  sql: string;
  values: readonly unknown[] | undefined;
};

function mockDb() {
  const calls: QueryCall[] = [];
  const db: Pick<DbPool, "query"> = {
    async query<T = unknown>(
      sql: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>> {
      calls.push({ sql, values });
      return { rows: [] as T[], rowCount: 1 };
    },
  };
  return { calls, db };
}

describe("recoverBillingCustomerFromCheckoutSession", () => {
  it("retrieves a Stripe customer from an owned checkout session and stores it", async () => {
    const { calls, db } = mockDb();
    const retrieves: string[] = [];

    const customerId = await recoverBillingCustomerFromCheckoutSession(
      {
        purchaseId: "purchase_owned",
        checkoutSessionId: "cs_test_owned",
      },
      {
        db,
        checkoutSessions: {
          async retrieve(sessionId: string) {
            retrieves.push(sessionId);
            return { customer: "cus_recovered" };
          },
        },
      },
    );

    assert.equal(customerId, "cus_recovered");
    assert.deepEqual(retrieves, ["cs_test_owned"]);
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.sql ?? "", /UPDATE purchases/);
    assert.match(calls[0]?.sql ?? "", /stripe_customer_id = \$1/);
    assert.deepEqual(calls[0]?.values, ["cus_recovered", "purchase_owned"]);
  });

  it("does not call Stripe for synthetic complimentary sessions", async () => {
    const { calls, db } = mockDb();
    let retrieveCalled = false;

    const customerId = await recoverBillingCustomerFromCheckoutSession(
      {
        purchaseId: "purchase_comp",
        checkoutSessionId: "comp_123",
      },
      {
        db,
        checkoutSessions: {
          async retrieve() {
            retrieveCalled = true;
            return { customer: "cus_should_not_be_used" };
          },
        },
      },
    );

    assert.equal(customerId, null);
    assert.equal(retrieveCalled, false);
    assert.equal(calls.length, 0);
  });

  it("treats a missing historical Stripe checkout session as unrecoverable", async () => {
    const { calls, db } = mockDb();

    const customerId = await recoverBillingCustomerFromCheckoutSession(
      {
        purchaseId: "purchase_old_session",
        checkoutSessionId: "cs_test_old",
      },
      {
        db,
        checkoutSessions: {
          async retrieve() {
            throw {
              type: "StripeInvalidRequestError",
              statusCode: 404,
              code: "resource_missing",
            };
          },
        },
      },
    );

    assert.equal(customerId, null);
    assert.equal(calls.length, 0);
  });
});

describe("billing portal route wiring", () => {
  it("passes the checkout-session customer recovery callback into the ownership helper", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

    assert.match(source, /recoverBillingCustomerFromCheckoutSession/);
    assert.match(source, /isAllowedReturnUrl\(returnUrl/);
    assert.match(source, /resolveOwnedBillingPortalCustomer\(\s*\{/);
    assert.match(source, /checkoutSessions:\s*stripeClient\.checkout\.sessions/);
  });
});
