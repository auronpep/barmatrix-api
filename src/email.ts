import type Stripe from "stripe";
import { Resend } from "resend";
import {
  createCheckoutAccessLink,
  type CheckoutAccessLinkInput,
  type ClerkAccessLinkResult,
} from "./clerk-access.js";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface EnrollmentEmailConfig {
  apiKey: string;
  from: string;
  supportEmail: string;
  replyTo: string;
  frontendUrl: string;
}

export interface EnrollmentEmailInput {
  to: string | null | undefined;
  fullName: string | null | undefined;
  checkoutSessionId: string;
  purchaseId?: string;
  accountAccessUrl?: string | null;
}

export interface TrapNamingEmailInput {
  to: string | null | undefined;
  fullName: string | null | undefined;
  trapNames: readonly (string | null | undefined)[] | null | undefined;
  doctrinalRule: string | null | undefined;
  /** Subject area of the top trap, e.g. "Criminal Law" — rendered as "(on X)". */
  trapSubject?: string | null;
  /** CTA target; defaults to the live Day-2 Foundations lesson. */
  nextStepUrl?: string | null;
  nextStepLabel?: string | null;
}

export interface EnrollmentEmailPayload {
  from: string;
  to: string[];
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export interface EnrollmentEmailClient {
  emails: {
    send(payload: EnrollmentEmailPayload): Promise<{
      data?: { id?: string } | null;
      error?: unknown | null;
    }>;
  };
}

export type EnrollmentEmailResult =
  | { status: "sent"; id: string | null }
  | {
      status: "skipped";
      reason:
        | "missing_config"
        | "missing_recipient"
        | "duplicate_fulfillment"
        | "missing_trap_or_rule";
    }
  | { status: "failed"; reason: "resend_error" };

interface SendEnrollmentEmailOptions {
  env?: Env;
  createClient?: (apiKey: string) => EnrollmentEmailClient;
}

interface CheckoutFulfillmentResult {
  status: "fulfilled" | "duplicate";
  purchaseId?: string;
  studentId?: string;
}

interface FulfillmentEmailOptions {
  sendEmail?: (input: EnrollmentEmailInput) => Promise<EnrollmentEmailResult>;
  createAccessLink?: (
    input: CheckoutAccessLinkInput,
  ) => Promise<ClerkAccessLinkResult>;
  logger?: Pick<typeof console, "log" | "warn" | "error">;
}

export function resolveEnrollmentEmailConfig(
  env: Env = process.env,
): EnrollmentEmailConfig | null {
  const apiKey = clean(env.RESEND_API_KEY);
  const from = clean(env.BARMATRIX_EMAIL_FROM);
  const supportEmail = clean(env.BARMATRIX_SUPPORT_EMAIL);
  if (!apiKey || !from || !supportEmail) {
    return null;
  }

  return {
    apiKey,
    from,
    supportEmail,
    replyTo: clean(env.BARMATRIX_REPLY_TO_EMAIL) ?? supportEmail,
    frontendUrl: stripTrailingSlash(clean(env.FRONTEND_URL) ?? "https://barmatrix.app"),
  };
}

export async function sendEnrollmentEmail(
  input: EnrollmentEmailInput,
  options: SendEnrollmentEmailOptions = {},
): Promise<EnrollmentEmailResult> {
  const config = resolveEnrollmentEmailConfig(options.env);
  if (!config) {
    return { status: "skipped", reason: "missing_config" };
  }

  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    return { status: "skipped", reason: "missing_recipient" };
  }

  return dispatchEmail(
    buildEnrollmentEmailPayload(input, recipient, config),
    config,
    options.createClient,
  );
}

export async function sendTrapNamingEmail(
  input: TrapNamingEmailInput,
  options: SendEnrollmentEmailOptions = {},
): Promise<EnrollmentEmailResult> {
  const config = resolveEnrollmentEmailConfig(options.env);
  if (!config) {
    return { status: "skipped", reason: "missing_config" };
  }

  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    return { status: "skipped", reason: "missing_recipient" };
  }

  // Copy spec: never send an email with empty placeholders. Require a real
  // named trap AND a real owned rule, otherwise skip this recipient.
  const hasTrap = (input.trapNames ?? []).some((t) => clean(t) !== null);
  const hasRule = clean(input.doctrinalRule) !== null;
  if (!hasTrap || !hasRule) {
    return { status: "skipped", reason: "missing_trap_or_rule" };
  }

  return dispatchEmail(
    buildTrapNamingPayload(input, recipient, config),
    config,
    options.createClient,
  );
}

export async function sendEnrollmentEmailForFulfillment(
  input: {
    session: Stripe.Checkout.Session;
    fulfillment: CheckoutFulfillmentResult;
  },
  options: FulfillmentEmailOptions = {},
): Promise<EnrollmentEmailResult> {
  if (input.fulfillment.status !== "fulfilled") {
    return { status: "skipped", reason: "duplicate_fulfillment" };
  }

  const sendEmail = options.sendEmail ?? sendEnrollmentEmail;
  const createAccessLink = options.createAccessLink ?? createCheckoutAccessLink;
  const logger = options.logger ?? console;
  let accessUrl: string | null = null;
  const profile = checkoutCustomerProfile(input.session);

  const accessResult = await createAccessLink({
    to: input.session.customer_details?.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    checkoutSessionId: input.session.id,
    purchaseId: input.fulfillment.purchaseId,
    studentId: input.fulfillment.studentId,
  }).catch((): ClerkAccessLinkResult => ({
    status: "failed",
    reason: "clerk_error",
  }));

  const context = {
    checkoutSessionId: input.session.id,
    purchaseId: input.fulfillment.purchaseId,
  };
  if (accessResult.status === "sent") {
    accessUrl = accessResult.accessUrl;
    logger.log("[clerk] checkout access link sent", {
      ...context,
      userId: accessResult.userId,
    });
  } else if (accessResult.status === "failed") {
    logger.error("[clerk] checkout access link failed", {
      ...context,
      reason: accessResult.reason,
    });
  } else {
    logger.warn("[clerk] checkout access link skipped", {
      ...context,
      reason: accessResult.reason,
    });
  }

  let result: EnrollmentEmailResult;
  try {
    result = await sendEmail({
      to: input.session.customer_details?.email,
      fullName: profile.fullName,
      checkoutSessionId: input.session.id,
      purchaseId: input.fulfillment.purchaseId,
      accountAccessUrl: accessUrl,
    });
  } catch {
    result = { status: "failed", reason: "resend_error" };
  }

  if (result.status === "sent") {
    logger.log("[email] enrollment email sent", {
      ...context,
      emailId: result.id,
    });
  } else if (result.status === "failed") {
    logger.error("[email] enrollment email failed", {
      ...context,
      reason: result.reason,
    });
  } else {
    logger.warn("[email] enrollment email skipped", {
      ...context,
      reason: result.reason,
    });
  }

  return result;
}

function checkoutCustomerProfile(session: Stripe.Checkout.Session): {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const firstName = checkoutCustomTextValue(session, "first_name");
  const lastName = checkoutCustomTextValue(session, "last_name");
  const customFullName =
    firstName || lastName ? [firstName, lastName].filter(Boolean).join(" ") : null;
  const fullName = customFullName || clean(session.customer_details?.name);

  return { firstName, lastName, fullName };
}

function checkoutCustomTextValue(
  session: Stripe.Checkout.Session,
  key: string,
): string | null {
  const field = session.custom_fields?.find((item) => item.key === key);
  return clean(field?.text?.value ?? null);
}

// ---------------------------------------------------------------------------
// Shared transactional dispatch
// ---------------------------------------------------------------------------

type DispatchResult =
  | { status: "sent"; id: string | null }
  | { status: "failed"; reason: "resend_error" };

async function dispatchEmail(
  payload: EnrollmentEmailPayload,
  config: EnrollmentEmailConfig,
  createClient?: (apiKey: string) => EnrollmentEmailClient,
): Promise<DispatchResult> {
  const client = createClient?.(config.apiKey) ?? new Resend(config.apiKey);
  try {
    const response = await client.emails.send(payload);
    if (response.error) {
      return { status: "failed", reason: "resend_error" };
    }
    return { status: "sent", id: response.data?.id ?? null };
  } catch {
    return { status: "failed", reason: "resend_error" };
  }
}

// ---------------------------------------------------------------------------
// Billing lifecycle emails (payment failed / installment receipt / upcoming)
// ---------------------------------------------------------------------------

export interface InvoiceEmailInput {
  to: string | null | undefined;
  fullName: string | null | undefined;
  amountCents: number | null | undefined;
  currency: string | null | undefined;
  hostedInvoiceUrl?: string | null;
  nextAttemptAt?: number | null;
}

export type InvoiceEmailResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: "missing_config" | "missing_recipient" }
  | { status: "failed"; reason: "resend_error" };

interface SendInvoiceEmailOptions {
  env?: Env;
  createClient?: (apiKey: string) => EnrollmentEmailClient;
}

async function sendInvoiceEmail(
  input: InvoiceEmailInput,
  buildPayload: (
    input: InvoiceEmailInput,
    recipient: string,
    config: EnrollmentEmailConfig,
  ) => EnrollmentEmailPayload,
  options: SendInvoiceEmailOptions,
): Promise<InvoiceEmailResult> {
  const config = resolveEnrollmentEmailConfig(options.env);
  if (!config) {
    return { status: "skipped", reason: "missing_config" };
  }

  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    return { status: "skipped", reason: "missing_recipient" };
  }

  return dispatchEmail(
    buildPayload(input, recipient, config),
    config,
    options.createClient,
  );
}

export async function sendPaymentFailedEmail(
  input: InvoiceEmailInput,
  options: SendInvoiceEmailOptions = {},
): Promise<InvoiceEmailResult> {
  return sendInvoiceEmail(input, buildPaymentFailedPayload, options);
}

export async function sendInstallmentReceiptEmail(
  input: InvoiceEmailInput,
  options: SendInvoiceEmailOptions = {},
): Promise<InvoiceEmailResult> {
  return sendInvoiceEmail(input, buildInstallmentReceiptPayload, options);
}

export async function sendUpcomingPaymentEmail(
  input: InvoiceEmailInput,
  options: SendInvoiceEmailOptions = {},
): Promise<InvoiceEmailResult> {
  return sendInvoiceEmail(input, buildUpcomingPaymentPayload, options);
}

// ---------------------------------------------------------------------------
// Stripe-invoice wrappers (extract + gate on real state change + log)
// ---------------------------------------------------------------------------

interface InvoiceEmailWrapperOptions {
  send?: (input: InvoiceEmailInput) => Promise<InvoiceEmailResult>;
  logger?: Pick<typeof console, "log" | "warn" | "error">;
}

export type BillingInvoice = Pick<
  Stripe.Invoice,
  | "id"
  | "customer_email"
  | "customer_name"
  | "amount_due"
  | "amount_paid"
  | "currency"
  | "hosted_invoice_url"
  | "next_payment_attempt"
  | "billing_reason"
>;

function invoiceInput(
  invoice: BillingInvoice,
  amountCents: number | null | undefined,
): InvoiceEmailInput {
  return {
    to: invoice.customer_email,
    fullName: invoice.customer_name,
    amountCents,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    nextAttemptAt: invoice.next_payment_attempt,
  };
}

function logInvoiceEmail(
  logger: Pick<typeof console, "log" | "warn" | "error">,
  kind: string,
  context: Record<string, unknown>,
  result: InvoiceEmailResult,
): void {
  if (result.status === "sent") {
    logger.log(`[email] ${kind} email sent`, { ...context, emailId: result.id });
  } else if (result.status === "failed") {
    logger.error(`[email] ${kind} email failed`, {
      ...context,
      reason: result.reason,
    });
  } else {
    logger.warn(`[email] ${kind} email skipped`, {
      ...context,
      reason: result.reason,
    });
  }
}

/**
 * Dunning email. Only fires when the invoice failure actually moved the
 * entitlement to suspended (so Stripe retries on the same failed invoice do
 * not re-notify the student).
 */
export async function sendPaymentFailedEmailForInvoice(
  input: { invoice: BillingInvoice; suspended: boolean },
  options: InvoiceEmailWrapperOptions = {},
): Promise<InvoiceEmailResult | { status: "skipped"; reason: "not_suspended" }> {
  const logger = options.logger ?? console;
  const context = { invoiceId: input.invoice.id };
  if (!input.suspended) {
    return { status: "skipped", reason: "not_suspended" };
  }

  const send = options.send ?? sendPaymentFailedEmail;
  let result: InvoiceEmailResult;
  try {
    result = await send(invoiceInput(input.invoice, input.invoice.amount_due));
  } catch {
    result = { status: "failed", reason: "resend_error" };
  }
  logInvoiceEmail(logger, "payment failed", context, result);
  return result;
}

/**
 * Receipt for a recorded installment payment. Skips the initial
 * subscription_create invoice (that customer already received the enrollment
 * welcome email) and only fires when the payment was newly recorded.
 */
export async function sendInstallmentReceiptForInvoice(
  input: {
    invoice: BillingInvoice;
    recorded: boolean;
  },
  options: InvoiceEmailWrapperOptions = {},
): Promise<
  InvoiceEmailResult | { status: "skipped"; reason: "not_recorded" | "initial_invoice" }
> {
  const logger = options.logger ?? console;
  const context = { invoiceId: input.invoice.id };
  if (!input.recorded) {
    return { status: "skipped", reason: "not_recorded" };
  }
  if (input.invoice.billing_reason === "subscription_create") {
    return { status: "skipped", reason: "initial_invoice" };
  }

  const send = options.send ?? sendInstallmentReceiptEmail;
  let result: InvoiceEmailResult;
  try {
    result = await send(invoiceInput(input.invoice, input.invoice.amount_paid));
  } catch {
    result = { status: "failed", reason: "resend_error" };
  }
  logInvoiceEmail(logger, "installment receipt", context, result);
  return result;
}

/**
 * Upcoming-charge reminder. Fired from invoice.upcoming (a preview event with
 * no invoice id). Only emails when an amount is actually due.
 */
export async function sendUpcomingPaymentEmailForInvoice(
  input: { invoice: BillingInvoice },
  options: InvoiceEmailWrapperOptions = {},
): Promise<InvoiceEmailResult | { status: "skipped"; reason: "nothing_due" }> {
  const logger = options.logger ?? console;
  const context = { customerEmail: input.invoice.customer_email ?? null };
  const amountDue = input.invoice.amount_due ?? 0;
  if (amountDue <= 0) {
    return { status: "skipped", reason: "nothing_due" };
  }

  const send = options.send ?? sendUpcomingPaymentEmail;
  let result: InvoiceEmailResult;
  try {
    result = await send(invoiceInput(input.invoice, amountDue));
  } catch {
    result = { status: "failed", reason: "resend_error" };
  }
  logInvoiceEmail(logger, "upcoming payment", context, result);
  return result;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function buildPaymentFailedPayload(
  input: InvoiceEmailInput,
  recipient: string,
  config: EnrollmentEmailConfig,
): EnrollmentEmailPayload {
  const accountUrl = `${config.frontendUrl}/account/`;
  const payUrl = clean(input.hostedInvoiceUrl) ?? accountUrl;
  const salutation = clean(input.fullName) ?? "Hi there";
  const amount = formatAmount(input.amountCents, input.currency);
  const amountClause = amount ? ` of ${amount}` : "";

  const text =
    `${salutation},\n\n` +
    `We weren't able to process your recent BarMatrix payment${amountClause}, ` +
    `so your account access has been paused.\n\n` +
    `Update your payment method to restore access: ${payUrl}\n\n` +
    `Once the payment goes through, your access is restored automatically. ` +
    `Need help? Reply to this email or contact ${config.supportEmail}.`;
  const html =
    `<p>${escapeHtml(salutation)},</p>` +
    `<p>We weren't able to process your recent BarMatrix payment${escapeHtml(
      amountClause,
    )}, so your account access has been paused.</p>` +
    `<p><a href="${escapeHtml(payUrl)}">Update your payment method</a> to restore access.</p>` +
    `<p>Once the payment goes through, your access is restored automatically. ` +
    `Need help? Reply to this email or contact ${escapeHtml(config.supportEmail)}.</p>`;

  return {
    from: config.from,
    to: [recipient],
    replyTo: config.replyTo,
    subject: "Action needed: your BarMatrix payment didn't go through",
    text,
    html,
  };
}

function buildInstallmentReceiptPayload(
  input: InvoiceEmailInput,
  recipient: string,
  config: EnrollmentEmailConfig,
): EnrollmentEmailPayload {
  const accountUrl = `${config.frontendUrl}/account/`;
  const salutation = clean(input.fullName) ?? "Hi there";
  const amount = formatAmount(input.amountCents, input.currency);
  const amountClause = amount ? ` of ${amount}` : "";

  const text =
    `${salutation},\n\n` +
    `We've received your BarMatrix payment${amountClause} — thank you. ` +
    `Your enrollment remains active.\n\n` +
    `Pick up where you left off: ${accountUrl}\n\n` +
    `Questions about your billing? Reply to this email or contact ${config.supportEmail}.`;
  const html =
    `<p>${escapeHtml(salutation)},</p>` +
    `<p>We've received your BarMatrix payment${escapeHtml(
      amountClause,
    )} — thank you. Your enrollment remains active.</p>` +
    `<p><a href="${escapeHtml(accountUrl)}">Pick up where you left off</a>.</p>` +
    `<p>Questions about your billing? Reply to this email or contact ${escapeHtml(
      config.supportEmail,
    )}.</p>`;

  return {
    from: config.from,
    to: [recipient],
    replyTo: config.replyTo,
    subject: "Payment received — your BarMatrix plan",
    text,
    html,
  };
}

function buildUpcomingPaymentPayload(
  input: InvoiceEmailInput,
  recipient: string,
  config: EnrollmentEmailConfig,
): EnrollmentEmailPayload {
  const accountUrl = `${config.frontendUrl}/account/`;
  const salutation = clean(input.fullName) ?? "Hi there";
  const amount = formatAmount(input.amountCents, input.currency);
  const amountClause = amount ? ` of ${amount}` : "";

  const text =
    `${salutation},\n\n` +
    `This is a heads-up that your next BarMatrix payment${amountClause} ` +
    `is scheduled soon.\n\n` +
    `Make sure your card on file is current so your access continues without ` +
    `interruption: ${accountUrl}\n\n` +
    `No action is needed if your payment details are up to date. ` +
    `Questions? Reply to this email or contact ${config.supportEmail}.`;
  const html =
    `<p>${escapeHtml(salutation)},</p>` +
    `<p>This is a heads-up that your next BarMatrix payment${escapeHtml(
      amountClause,
    )} is scheduled soon.</p>` +
    `<p><a href="${escapeHtml(accountUrl)}">Review your payment details</a> so your ` +
    `access continues without interruption.</p>` +
    `<p>No action is needed if your payment details are up to date. ` +
    `Questions? Reply to this email or contact ${escapeHtml(config.supportEmail)}.</p>`;

  return {
    from: config.from,
    to: [recipient],
    replyTo: config.replyTo,
    subject: "Heads up: your BarMatrix payment is coming up",
    text,
    html,
  };
}

export function buildTrapNamingPayload(
  input: TrapNamingEmailInput,
  recipient: string,
  config: EnrollmentEmailConfig,
): EnrollmentEmailPayload {
  const firstName = clean(input.fullName);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const trapName = formatTrapNames(input.trapNames);
  const trapSubject = clean(input.trapSubject);
  const onSubject = trapSubject ? ` (on ${trapSubject})` : "";
  const ruleOwned =
    clean(input.doctrinalRule) ?? "the doctrinal rule you reviewed on Day 1";
  const nextStepUrl =
    clean(input.nextStepUrl) ??
    `${stripTrailingSlash(config.frontendUrl)}/foundations/lesson-01`;
  const nextStepLabel = clean(input.nextStepLabel) ?? "Start your Day-2 block";

  // Copy: docs/c3-enhancements/day1-trap-naming-email-copy.md (Worker C, A7).
  // Christian theming is intentional and founder-mandated — one warm faith-touch
  // in the open, one in the P.S. Trap explanation / "the tell" are omitted here
  // because we don't yet have a per-trap explanation source; the email still
  // names the trap, its subject, the rule owned, and the next step.
  const subject = `The "${trapName}" trap — and the rule you own tonight`;

  const text =
    `${greeting}\n\n` +
    `You showed up and did the hard thing today — you let the diagnostic see your real game tape. ` +
    `That takes nerve, and we're glad you're here. God's given you the discipline to do this work; ` +
    `our job is to point it at the right target.\n\n` +
    `So here's what we saw.\n\n` +
    `The trap that pulled you hardest: ${trapName}${onSubject}.\n\n` +
    `It's one of the most common traps on the MBE — and it's not a knowledge gap. You knew the law. ` +
    `The question was just built so the wrong answer felt more right than the correct one. ` +
    `That's a pattern, and patterns can be beaten.\n\n` +
    `The move: Cut the answers that are wrong on the law, put the last two in Clash, and make the ` +
    `Call on the controlling distinction — not the gut.\n\n` +
    `And here's the rule you now own:\n${ruleOwned}\n\n` +
    `Keep that one. You didn't have it this morning. You do tonight.\n\n` +
    `Tomorrow we turn this into a reflex — one short block, aimed straight at the trap you fell for today.\n\n` +
    `${nextStepLabel}: ${nextStepUrl}\n\n` +
    `You've got this. We're walking it with you.\n\n` +
    `— The BarMatrix Team\n\n` +
    `P.S. You're part of our founding cohort — early, and helping shape this. That means something to us. ` +
    `Praying this is the cycle it finally clicks.`;

  const html =
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>You showed up and did the hard thing today — you let the diagnostic see your real game tape. ` +
    `That takes nerve, and we're glad you're here. God's given you the discipline to do this work; ` +
    `our job is to point it at the right target.</p>` +
    `<p>So here's what we saw.</p>` +
    `<p><strong>The trap that pulled you hardest: ${escapeHtml(trapName)}${escapeHtml(onSubject)}.</strong></p>` +
    `<p>It's one of the most common traps on the MBE — and it's not a knowledge gap. You knew the law. ` +
    `The question was just built so the wrong answer felt more right than the correct one. ` +
    `That's a pattern, and patterns can be beaten.</p>` +
    `<p><strong>The move:</strong> Cut the answers that are wrong on the law, put the last two in Clash, ` +
    `and make the Call on the controlling distinction — not the gut.</p>` +
    `<p><strong>And here's the rule you now own:</strong></p>` +
    `<blockquote>${escapeHtml(ruleOwned)}</blockquote>` +
    `<p>Keep that one. You didn't have it this morning. You do tonight.</p>` +
    `<p>Tomorrow we turn this into a reflex — one short block, aimed straight at the trap you fell for today.</p>` +
    `<p><a href="${escapeHtml(nextStepUrl)}">${escapeHtml(nextStepLabel)} &rarr;</a></p>` +
    `<p>You've got this. We're walking it with you.</p>` +
    `<p>— The BarMatrix Team</p>` +
    `<p><em>P.S. You're part of our founding cohort — early, and helping shape this. That means ` +
    `something to us. Praying this is the cycle it finally clicks.</em></p>`;

  return {
    from: config.from,
    to: [recipient],
    replyTo: config.replyTo,
    subject,
    text,
    html,
  };
}

function formatTrapNames(
  values: readonly (string | null | undefined)[] | null | undefined,
): string {
  const names = (values ?? [])
    .map(clean)
    .filter((value): value is string => value !== null);

  if (names.length === 0) {
    return "your Day 1 cognitive trap";
  }
  if (names.length === 1) {
    return names[0]!;
  }
  if (names.length === 2) {
    return `${names[0]!} and ${names[1]!}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]!}`;
}

function formatAmount(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) {
    return null;
  }
  const code = clean(currency)?.toUpperCase() ?? "USD";
  const value = (cents / 100).toFixed(2);
  return code === "USD" ? `$${value}` : `${value} ${code}`;
}

function buildEnrollmentEmailPayload(
  input: EnrollmentEmailInput,
  recipient: string,
  config: EnrollmentEmailConfig,
): EnrollmentEmailPayload {
  const accessUrl =
    clean(input.accountAccessUrl) ??
    `${config.frontendUrl}/sign-up?after=dashboard&source=enrollment_email`;
  const salutation = clean(input.fullName) ?? "Welcome to BarMatrix";
  const text =
    `${salutation},\n\n` +
    `Your BarMatrix enrollment is active. Access your account at ${accessUrl}.\n\n` +
    `Questions? Reply to this email or contact ${config.supportEmail}.`;
  const html =
    `<p>${escapeHtml(salutation)},</p>` +
    "<p>Your BarMatrix enrollment is active.</p>" +
    `<p><a href="${escapeHtml(accessUrl)}">Access your account</a></p>` +
    `<p>Questions? Reply to this email or contact ${escapeHtml(
      config.supportEmail,
    )}.</p>`;

  return {
    from: config.from,
    to: [recipient],
    replyTo: config.replyTo,
    subject: "Your BarMatrix access is ready",
    text,
    html,
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
