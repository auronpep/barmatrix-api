import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  resolveEnrollmentEmailConfig,
  sendEnrollmentEmail,
  sendEnrollmentEmailForFulfillment,
  sendInstallmentReceiptForInvoice,
  sendPaymentFailedEmail,
  sendPaymentFailedEmailForInvoice,
  sendUpcomingPaymentEmailForInvoice,
  type BillingInvoice,
  type EnrollmentEmailClient,
  type InvoiceEmailInput,
} from "./email.js";

function configuredEnv(): Record<string, string> {
  return {
    RESEND_API_KEY: "re_test_placeholder",
    BARMATRIX_EMAIL_FROM: "BarMatrix <access@barmatrix.app>",
    BARMATRIX_SUPPORT_EMAIL: "support@barmatrix.app",
    BARMATRIX_REPLY_TO_EMAIL: "help@barmatrix.app",
    FRONTEND_URL: "https://barmatrix.app",
  };
}

describe("enrollment email config", () => {
  it("stays disabled when required transactional email env is missing", () => {
    assert.equal(resolveEnrollmentEmailConfig({}), null);
    assert.equal(
      resolveEnrollmentEmailConfig({
        RESEND_API_KEY: "re_test_placeholder",
        BARMATRIX_EMAIL_FROM: "BarMatrix <access@barmatrix.app>",
      }),
      null,
    );
  });

  it("uses support as reply-to when no dedicated reply-to mailbox is set", () => {
    const config = resolveEnrollmentEmailConfig({
      RESEND_API_KEY: "re_test_placeholder",
      BARMATRIX_EMAIL_FROM: "BarMatrix <access@barmatrix.app>",
      BARMATRIX_SUPPORT_EMAIL: "support@barmatrix.app",
      FRONTEND_URL: "https://barmatrix.app/",
    });

    assert.deepEqual(config, {
      apiKey: "re_test_placeholder",
      from: "BarMatrix <access@barmatrix.app>",
      supportEmail: "support@barmatrix.app",
      replyTo: "support@barmatrix.app",
      frontendUrl: "https://barmatrix.app",
    });
  });
});

describe("sendEnrollmentEmail", () => {
  it("skips without constructing a Resend client when config is missing", async () => {
    let constructed = false;

    const result = await sendEnrollmentEmail(
      {
        to: "student@example.com",
        fullName: "Student Example",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
      },
      {
        env: {},
        createClient: () => {
          constructed = true;
          throw new Error("client should not be constructed");
        },
      },
    );

    assert.deepEqual(result, { status: "skipped", reason: "missing_config" });
    assert.equal(constructed, false);
  });

  it("sends the enrollment access email through the configured Resend client", async () => {
    const sentPayloads: unknown[] = [];
    const client: EnrollmentEmailClient = {
      emails: {
        send: async (payload) => {
          sentPayloads.push(payload);
          return { data: { id: "email_123" }, error: null };
        },
      },
    };

    const result = await sendEnrollmentEmail(
      {
        to: " Student@Example.com ",
        fullName: "Student Example",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
      },
      {
        env: configuredEnv(),
        createClient: () => client,
      },
    );

    assert.deepEqual(result, { status: "sent", id: "email_123" });
    assert.equal(sentPayloads.length, 1);
    assert.deepEqual(sentPayloads[0], {
      from: "BarMatrix <access@barmatrix.app>",
      to: ["student@example.com"],
      replyTo: "help@barmatrix.app",
      subject: "Your BarMatrix access is ready",
      text:
        "Student Example,\n\nYour BarMatrix enrollment is active. Access your account at https://barmatrix.app/account/.\n\nQuestions? Reply to this email or contact support@barmatrix.app.",
      html:
        "<p>Student Example,</p><p>Your BarMatrix enrollment is active.</p><p><a href=\"https://barmatrix.app/account/\">Access your account</a></p><p>Questions? Reply to this email or contact support@barmatrix.app.</p>",
    });
  });

  it("returns a failed result when Resend rejects delivery", async () => {
    const client: EnrollmentEmailClient = {
      emails: {
        send: async () => ({ data: null, error: { message: "rejected" } }),
      },
    };

    const result = await sendEnrollmentEmail(
      {
        to: "student@example.com",
        fullName: null,
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
      },
      {
        env: configuredEnv(),
        createClient: () => client,
      },
    );

    assert.deepEqual(result, { status: "failed", reason: "resend_error" });
  });
});

describe("sendEnrollmentEmailForFulfillment", () => {
  const session = {
    id: "cs_test_123",
    customer_details: {
      email: " Student@Example.com ",
      name: "Student Example",
    },
  } as Stripe.Checkout.Session;

  it("does not send on duplicate checkout fulfillment replay", async () => {
    let called = false;

    const result = await sendEnrollmentEmailForFulfillment(
      {
        session,
        fulfillment: { status: "duplicate", purchaseId: "purchase_123" },
      },
      {
        sendEmail: async () => {
          called = true;
          return { status: "sent", id: "email_123" };
        },
      },
    );

    assert.deepEqual(result, {
      status: "skipped",
      reason: "duplicate_fulfillment",
    });
    assert.equal(called, false);
  });

  it("surfaces delivery failure without throwing after fulfillment", async () => {
    const errors: unknown[] = [];

    const result = await sendEnrollmentEmailForFulfillment(
      {
        session,
        fulfillment: { status: "fulfilled", purchaseId: "purchase_123" },
      },
      {
        sendEmail: async () => ({ status: "failed", reason: "resend_error" }),
        logger: {
          log: () => {},
          warn: () => {},
          error: (...args: unknown[]) => {
            errors.push(args);
          },
        },
      },
    );

    assert.deepEqual(result, { status: "failed", reason: "resend_error" });
    assert.deepEqual(errors, [
      [
        "[email] enrollment email failed",
        {
          checkoutSessionId: "cs_test_123",
          purchaseId: "purchase_123",
          reason: "resend_error",
        },
      ],
    ]);
  });
});

function captureClient(sent: unknown[]): EnrollmentEmailClient {
  return {
    emails: {
      send: async (payload) => {
        sent.push(payload);
        return { data: { id: "email_billing" }, error: null };
      },
    },
  };
}

const failedInvoice: BillingInvoice = {
  id: "in_test_failed",
  customer_email: " Student@Example.com ",
  customer_name: "Student Example",
  amount_due: 49900,
  amount_paid: 0,
  currency: "usd",
  hosted_invoice_url: "https://pay.stripe.com/invoice/test",
  next_payment_attempt: null,
  billing_reason: "subscription_cycle",
};

const succeededInvoice: BillingInvoice = {
  id: "in_test_succeeded",
  customer_email: "student@example.com",
  customer_name: "Student Example",
  amount_due: 0,
  amount_paid: 49900,
  currency: "usd",
  hosted_invoice_url: null,
  next_payment_attempt: null,
  billing_reason: "subscription_cycle",
};

describe("sendPaymentFailedEmail", () => {
  it("skips when transactional email config is missing", async () => {
    const result = await sendPaymentFailedEmail(
      {
        to: "student@example.com",
        fullName: "Student Example",
        amountCents: 49900,
        currency: "usd",
      },
      { env: {}, createClient: () => captureClient([]) },
    );
    assert.deepEqual(result, { status: "skipped", reason: "missing_config" });
  });

  it("sends a dunning email with the hosted invoice link and amount", async () => {
    const sent: Array<{ to: string[]; subject: string; text: string }> = [];
    const result = await sendPaymentFailedEmail(
      {
        to: " Student@Example.com ",
        fullName: "Student Example",
        amountCents: 49900,
        currency: "usd",
        hostedInvoiceUrl: "https://pay.stripe.com/invoice/test",
      },
      {
        env: configuredEnv(),
        createClient: () => captureClient(sent),
      },
    );

    assert.deepEqual(result, { status: "sent", id: "email_billing" });
    assert.equal(sent.length, 1);
    const payload = sent[0];
    assert.ok(payload);
    assert.deepEqual(payload.to, ["student@example.com"]);
    assert.match(payload.subject, /didn't go through/);
    assert.match(payload.text, /\$499\.00/);
    assert.match(payload.text, /pay\.stripe\.com\/invoice\/test/);
  });
});

describe("sendPaymentFailedEmailForInvoice", () => {
  it("does not email when the failure did not newly suspend the entitlement", async () => {
    let called = false;
    const result = await sendPaymentFailedEmailForInvoice(
      { invoice: failedInvoice, suspended: false },
      {
        send: async () => {
          called = true;
          return { status: "sent", id: "x" };
        },
      },
    );
    assert.deepEqual(result, { status: "skipped", reason: "not_suspended" });
    assert.equal(called, false);
  });

  it("emails the amount_due when a new suspension occurred", async () => {
    const inputs: InvoiceEmailInput[] = [];
    const result = await sendPaymentFailedEmailForInvoice(
      { invoice: failedInvoice, suspended: true },
      {
        send: async (input) => {
          inputs.push(input);
          return { status: "sent", id: "email_billing" };
        },
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      },
    );
    assert.deepEqual(result, { status: "sent", id: "email_billing" });
    assert.equal(inputs.length, 1);
    const input = inputs[0];
    assert.ok(input);
    assert.equal(input.amountCents, 49900);
    assert.equal(input.to, " Student@Example.com ");
  });

  it("does not throw when delivery fails", async () => {
    const result = await sendPaymentFailedEmailForInvoice(
      { invoice: failedInvoice, suspended: true },
      {
        send: async () => {
          throw new Error("network down");
        },
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      },
    );
    assert.deepEqual(result, { status: "failed", reason: "resend_error" });
  });
});

describe("sendInstallmentReceiptForInvoice", () => {
  it("skips when nothing was newly recorded (duplicate replay)", async () => {
    let called = false;
    const result = await sendInstallmentReceiptForInvoice(
      { invoice: succeededInvoice, recorded: false },
      {
        send: async () => {
          called = true;
          return { status: "sent", id: "x" };
        },
      },
    );
    assert.deepEqual(result, { status: "skipped", reason: "not_recorded" });
    assert.equal(called, false);
  });

  it("skips the initial subscription_create invoice (already got the welcome email)", async () => {
    let called = false;
    const result = await sendInstallmentReceiptForInvoice(
      {
        invoice: { ...succeededInvoice, billing_reason: "subscription_create" },
        recorded: true,
      },
      {
        send: async () => {
          called = true;
          return { status: "sent", id: "x" };
        },
      },
    );
    assert.deepEqual(result, { status: "skipped", reason: "initial_invoice" });
    assert.equal(called, false);
  });

  it("emails the amount_paid for a newly recorded installment", async () => {
    const inputs: InvoiceEmailInput[] = [];
    const result = await sendInstallmentReceiptForInvoice(
      { invoice: succeededInvoice, recorded: true },
      {
        send: async (input) => {
          inputs.push(input);
          return { status: "sent", id: "email_billing" };
        },
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      },
    );
    assert.deepEqual(result, { status: "sent", id: "email_billing" });
    assert.equal(inputs[0].amountCents, 49900);
  });
});

describe("sendUpcomingPaymentEmailForInvoice", () => {
  it("skips when nothing is due", async () => {
    let called = false;
    const result = await sendUpcomingPaymentEmailForInvoice(
      { invoice: { ...failedInvoice, amount_due: 0 } },
      {
        send: async () => {
          called = true;
          return { status: "sent", id: "x" };
        },
      },
    );
    assert.deepEqual(result, { status: "skipped", reason: "nothing_due" });
    assert.equal(called, false);
  });

  it("emails the amount_due ahead of the charge", async () => {
    const inputs: InvoiceEmailInput[] = [];
    const result = await sendUpcomingPaymentEmailForInvoice(
      { invoice: failedInvoice },
      {
        send: async (input) => {
          inputs.push(input);
          return { status: "sent", id: "email_billing" };
        },
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      },
    );
    assert.deepEqual(result, { status: "sent", id: "email_billing" });
    assert.equal(inputs[0].amountCents, 49900);
  });
});
