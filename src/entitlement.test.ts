import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import mysql from "mysql2/promise";
import type Stripe from "stripe";
import type { DbClient, DbPool, QueryResult } from "./db.js";
import {
  twoPaySecondInvoiceFailed,
  twoPaySecondInvoiceSucceeded,
} from "./fixtures/stripe-events.js";

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

type MysqlScriptStep = {
  match: RegExp;
  result: unknown[] | { affectedRows?: number };
};

const mysqlCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
let mysqlScript: MysqlScriptStep[] = [];

async function executeMysql(
  sql: string,
  values: readonly unknown[] = [],
): Promise<[unknown[] | { affectedRows?: number }]> {
  mysqlCalls.push({ sql, values });
  const step = mysqlScript.shift();
  assert.ok(step, `unexpected mysql query: ${sql}`);
  assert.match(sql, step.match);
  return [step.result];
}

const mysqlConnection = {
  execute: executeMysql,
  release: () => {},
};

const mysqlPool = {
  execute: executeMysql,
  getConnection: async () => mysqlConnection,
  end: async () => {},
};

mock.method(mysql, "createPool", () => mysqlPool as never);

function scriptMysql(steps: MysqlScriptStep[]): void {
  mysqlCalls.length = 0;
  mysqlScript = [...steps];
}

const {
  fulfillCheckoutSession,
  recordInstallmentPayment,
  suspendEntitlement,
} = await import("./entitlement.js");

interface ScriptStep {
  match: RegExp;
  result?: QueryResult<unknown>;
  error?: unknown;
}

function rows<T>(items: T[]): QueryResult<T> {
  return { rows: items, rowCount: items.length };
}

function duplicateCheckoutSessionError(): Error & { code: string; errno: number } {
  const err = new Error(
    "Duplicate entry 'cs_test_duplicate' for key 'uq_purchases_checkout_session'",
  ) as Error & { code: string; errno: number };
  err.code = "ER_DUP_ENTRY";
  err.errno = 1062;
  return err;
}

class ScriptedClient implements DbClient {
  calls: string[] = [];

  constructor(private readonly steps: ScriptStep[]) {}

  async query<T>(
    sql: string,
    _values?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    this.calls.push(sql);
    const step = this.steps.shift();
    assert.ok(step, `unexpected query: ${sql}`);
    assert.match(sql, step.match);
    if (step.error) throw step.error;
    return (step.result ?? rows([])) as QueryResult<T>;
  }

  release(): void {}
}

function poolFor(client: DbClient): Pick<DbPool, "connect"> {
  return {
    connect: async () => client,
  };
}

function checkoutSession(): Stripe.Checkout.Session {
  return {
    id: "cs_test_duplicate",
    object: "checkout.session",
    amount_total: 99900,
    customer: "cus_test_duplicate",
    customer_details: {
      email: "buyer@example.test",
      name: "Buyer Example",
    },
    metadata: {
      payment_plan: "pay_in_full",
    },
  } as unknown as Stripe.Checkout.Session;
}

describe("fulfillCheckoutSession idempotency", () => {
  it("treats a checkout-session unique-key race as duplicate without assigning another seat", async () => {
    const client = new ScriptedClient([
      { match: /^BEGIN$/ },
      {
        match: /SELECT purchase_id FROM purchases WHERE stripe_checkout_session_id/,
        result: rows([]),
      },
      { match: /INSERT INTO students/ },
      {
        match: /SELECT student_id FROM students/,
        result: rows([{ student_id: "student_1" }]),
      },
      {
        match: /SELECT cohort_id FROM cohort_config/,
        result: rows([{ cohort_id: "cohort_1" }]),
      },
      {
        match: /INSERT INTO purchases/,
        error: duplicateCheckoutSessionError(),
      },
      {
        match: /SELECT purchase_id FROM purchases WHERE stripe_checkout_session_id/,
        result: rows([{ purchase_id: "purchase_existing" }]),
      },
      { match: /^COMMIT$/ },
    ]);
    let seatAssigned = false;

    const result = await fulfillCheckoutSession(
      { session: checkoutSession(), subscriptionId: null },
      {
        pool: poolFor(client),
        createId: () => "purchase_new",
        assignSeat: async () => {
          seatAssigned = true;
          return 1;
        },
        logger: {
          log: () => {},
          warn: () => {},
        },
      },
    );

    assert.deepEqual(result, {
      status: "duplicate",
      purchaseId: "purchase_existing",
    });
    assert.equal(seatAssigned, false);
  });
});

describe("two-pay deferred invoice entitlement handling", () => {
  it("records a second-installment invoice once and stores the invoice id for idempotency", async () => {
    scriptMysql([
      { match: /^BEGIN$/, result: [] },
      {
        match: /SELECT purchase_id, metadata FROM purchases WHERE stripe_subscription_id = \?/,
        result: [{ purchase_id: "purchase_two_pay", metadata: "{}" }],
      },
      {
        match: /UPDATE purchases\s+SET net_collected_cents/,
        result: { affectedRows: 1 },
      },
      { match: /^COMMIT$/, result: { affectedRows: 0 } },
    ]);

    await recordInstallmentPayment(twoPaySecondInvoiceSucceeded());

    const update = mysqlCalls.find((call) =>
      call.sql.includes("SET net_collected_cents"),
    );
    assert.ok(update);
    assert.deepEqual(update.values, [
      49900,
      JSON.stringify(["in_test_two_pay_second_succeeded"]),
      "purchase_two_pay",
    ]);
    assert.equal(mysqlScript.length, 0);
  });

  it("does not double-count a replayed second-installment invoice", async () => {
    scriptMysql([
      { match: /^BEGIN$/, result: [] },
      {
        match: /SELECT purchase_id, metadata FROM purchases WHERE stripe_subscription_id = \?/,
        result: [
          {
            purchase_id: "purchase_two_pay",
            metadata: JSON.stringify({
              recorded_invoices: ["in_test_two_pay_second_succeeded"],
            }),
          },
        ],
      },
      { match: /^ROLLBACK$/, result: { affectedRows: 0 } },
    ]);

    await recordInstallmentPayment(twoPaySecondInvoiceSucceeded());

    assert.equal(
      mysqlCalls.some((call) => call.sql.includes("SET net_collected_cents")),
      false,
    );
    assert.equal(mysqlScript.length, 0);
  });

  it("suspends entitlement when the deferred invoice fails", async () => {
    scriptMysql([
      {
        match: /UPDATE purchases\s+SET entitlement_status = 'suspended'/,
        result: { affectedRows: 1 },
      },
      {
        match: /SELECT purchase_id FROM purchases WHERE stripe_subscription_id = \?/,
        result: [{ purchase_id: "purchase_two_pay" }],
      },
    ]);

    await suspendEntitlement(twoPaySecondInvoiceFailed());

    const update = mysqlCalls[0];
    assert.ok(update);
    assert.match(update.sql, /entitlement_status = 'suspended'/);
    assert.deepEqual(update.values, ["sub_test_two_pay_fixture"]);
    assert.equal(mysqlScript.length, 0);
  });
});
