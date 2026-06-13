import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  buildTrapNamingPayload,
  resolveEnrollmentEmailConfig,
  sendEnrollmentEmail,
  sendEnrollmentEmailForFulfillment,
  sendInstallmentReceiptForInvoice,
  sendPaymentFailedEmail,
  sendTrapNamingEmail,
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
        accountAccessUrl: "https://accounts.barmatrix.app/sign-in/token/abc",
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
        "Student Example,\n\nYour BarMatrix enrollment is active. Access your account at https://accounts.barmatrix.app/sign-in/token/abc.\n\nQuestions? Reply to this email or contact support@barmatrix.app.",
      html:
        "<p>Student Example,</p><p>Your BarMatrix enrollment is active.</p><p><a href=\"https://accounts.barmatrix.app/sign-in/token/abc\">Access your account</a></p><p>Questions? Reply to this email or contact support@barmatrix.app.</p>",
    });
  });

  it("falls back to the sign-up path when no account access URL is available", async () => {
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
        to: "student@example.com",
        fullName: null,
        checkoutSessionId: "cs_test_123",
      },
      {
        env: configuredEnv(),
        createClient: () => client,
      },
    );

    assert.deepEqual(result, { status: "sent", id: "email_123" });
    assert.match(
      (sentPayloads[0] as { text: string }).text,
      /https:\/\/barmatrix\.app\/sign-up\?after=dashboard&source=enrollment_email/,
    );
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
      name: null,
    },
    custom_fields: [
      {
        key: "first_name",
        type: "text",
        text: { value: "Student" },
      },
      {
        key: "last_name",
        type: "text",
        text: { value: "Example" },
      },
    ],
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
        createAccessLink: async () => {
          called = true;
          return { status: "sent", userId: "user_123", accessUrl: null };
        },
      },
    );

    assert.deepEqual(result, {
      status: "skipped",
      reason: "duplicate_fulfillment",
    });
    assert.equal(called, false);
  });

  it("creates a Clerk access link before sending enrollment email", async () => {
    const accessInputs: unknown[] = [];
    const emailInputs: unknown[] = [];

    const result = await sendEnrollmentEmailForFulfillment(
      {
        session,
        fulfillment: {
          status: "fulfilled",
          purchaseId: "purchase_123",
          studentId: "student_123",
        },
      },
      {
        createAccessLink: async (input) => {
          accessInputs.push(input);
          return {
            status: "sent",
            userId: "user_123",
            accessUrl: "https://accounts.barmatrix.app/sign-in/token/abc",
          };
        },
        sendEmail: async (input) => {
          emailInputs.push(input);
          return { status: "sent", id: "email_123" };
        },
        logger: {
          log: () => {},
          warn: () => {},
          error: () => {},
        },
      },
    );

    assert.deepEqual(result, { status: "sent", id: "email_123" });
    assert.deepEqual(accessInputs, [
      {
        to: " Student@Example.com ",
        firstName: "Student",
        lastName: "Example",
        fullName: "Student Example",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
        studentId: "student_123",
      },
    ]);
    assert.deepEqual(emailInputs, [
      {
        to: " Student@Example.com ",
        fullName: "Student Example",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
        accountAccessUrl: "https://accounts.barmatrix.app/sign-in/token/abc",
      },
    ]);
  });

  it("does not send a signup fallback email when Clerk access provisioning fails", async () => {
    let emailCalled = false;
    const errors: unknown[] = [];

    const result = await sendEnrollmentEmailForFulfillment(
      {
        session,
        fulfillment: {
          status: "fulfilled",
          purchaseId: "purchase_123",
          studentId: "student_123",
        },
      },
      {
        createAccessLink: async () => ({
          status: "failed",
          reason: "clerk_error",
        }),
        sendEmail: async () => {
          emailCalled = true;
          return { status: "sent", id: "email_123" };
        },
        logger: {
          log: () => {},
          warn: () => {},
          error: (...args: unknown[]) => {
            errors.push(args);
          },
        },
      },
    );

    assert.deepEqual(result, {
      status: "failed",
      reason: "clerk_access_unavailable",
    });
    assert.equal(emailCalled, false);
    assert.deepEqual(errors, [
      [
        "[clerk] checkout access link failed",
        {
          checkoutSessionId: "cs_test_123",
          purchaseId: "purchase_123",
          reason: "clerk_error",
        },
      ],
    ]);
  });

  it("surfaces delivery failure without throwing after fulfillment", async () => {
    const errors: unknown[] = [];

    const result = await sendEnrollmentEmailForFulfillment(
      {
        session,
        fulfillment: { status: "fulfilled", purchaseId: "purchase_123" },
      },
      {
        createAccessLink: async () => ({
          status: "sent",
          userId: "user_123",
          accessUrl: "https://accounts.barmatrix.app/sign-in/token/abc",
        }),
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

describe("buildTrapNamingPayload", () => {
  it("renders the trap, subject, owned rule, and a next-step CTA", () => {
    const config = resolveEnrollmentEmailConfig(configuredEnv());
    assert.ok(config);

    const payload = buildTrapNamingPayload(
      {
        to: null,
        fullName: "Sunny",
        trapNames: ["Bait Doctrine"],
        doctrinalRule: "A valid FRCP on point controls over a conflicting state rule.",
        trapSubject: "Civil Procedure",
        nextStepLabel: "Start your Day-2 block",
        nextStepUrl: "https://barmatrix.app/foundations/lesson-01",
      },
      "student@example.com",
      config,
    );

    assert.deepEqual(payload.to, ["student@example.com"]);
    assert.equal(payload.from, "BarMatrix <access@barmatrix.app>");
    assert.match(payload.subject, /Bait Doctrine/);
    assert.match(payload.text, /Bait Doctrine \(on Civil Procedure\)/);
    assert.match(payload.html, /Bait Doctrine \(on Civil Procedure\)/);
    assert.match(payload.text, /A valid FRCP on point controls/);
    assert.match(payload.html, /A valid FRCP on point controls/);
    assert.match(payload.html, /href="https:\/\/barmatrix\.app\/foundations\/lesson-01"/);
    assert.match(payload.text, /Start your Day-2 block/);
    // founder-mandated faith touch is present
    assert.match(payload.text, /founding cohort/);
  });

  it("greets generically without a name and defaults the CTA to the live Day-2 lesson", () => {
    const config = resolveEnrollmentEmailConfig(configuredEnv());
    assert.ok(config);
    const payload = buildTrapNamingPayload(
      {
        to: null,
        fullName: null,
        trapNames: ["Wrong-Element"],
        doctrinalRule: "Larceny requires intent at the time of taking.",
      },
      "x@example.com",
      config,
    );
    assert.match(payload.text, /^Hi there,/);
    assert.match(payload.html, /barmatrix\.app\/foundations\/lesson-01/);
  });
});

describe("sendTrapNamingEmail", () => {
  it("sends the trap-naming email through the configured Resend client", async () => {
    const sentPayloads: unknown[] = [];
    const client: EnrollmentEmailClient = {
      emails: {
        send: async (payload) => {
          sentPayloads.push(payload);
          return { data: { id: "email_trap" }, error: null };
        },
      },
    };

    const result = await sendTrapNamingEmail(
      {
        to: " Student@Example.com ",
        fullName: "Student Example",
        trapNames: ["Element Drift"],
        doctrinalRule: "Use element-by-element analysis.",
        trapSubject: "Torts",
      },
      {
        env: configuredEnv(),
        createClient: () => client,
      },
    );

    assert.deepEqual(result, { status: "sent", id: "email_trap" });
    assert.equal(sentPayloads.length, 1);
    const payload = sentPayloads[0] as { to: string[]; subject: string; text: string };
    assert.deepEqual(payload.to, ["student@example.com"]);
    assert.match(payload.subject, /Element Drift/);
    assert.match(payload.text, /Element Drift/);
    assert.match(payload.text, /Use element-by-element analysis/);
  });

  it("skips (never sends empty) when the trap or owned rule is missing", async () => {
    let sends = 0;
    const client: EnrollmentEmailClient = {
      emails: {
        send: async () => {
          sends += 1;
          return { data: { id: "x" }, error: null };
        },
      },
    };
    const result = await sendTrapNamingEmail(
      { to: "student@example.com", fullName: "Student", trapNames: [], doctrinalRule: null },
      { env: configuredEnv(), createClient: () => client },
    );
    assert.equal(result.status, "skipped");
    assert.equal(sends, 0);
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
    const input = inputs[0];
    assert.ok(input);
    assert.equal(input.amountCents, 49900);
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
    const input = inputs[0];
    assert.ok(input);
    assert.equal(input.amountCents, 49900);
  });
});
