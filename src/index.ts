// BarMatrix API — Day 1 skeleton.
// Production target: Google Cloud Run at api.barmatrix.app (see ADR 0004).
// Contracts: BARMATRIX/engineering/API_CONTRACTS.md (SRC-0020)
// Schema:    BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql (Postgres canonical)

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { isSentryEnabled, setupSentryErrorHandler } from "./sentry.js";
import { getPool, ping } from "./db.js";
import { CAPACITY_COPY, type CohortPublicStatus } from "./copy.js";
import {
  fulfillCheckoutSession,
  recordInstallmentPayment,
  suspendEntitlement,
} from "./entitlement.js";
import {
  sendEnrollmentEmailForFulfillment,
  sendInstallmentReceiptForInvoice,
  sendPaymentFailedEmailForInvoice,
  sendUpcomingPaymentEmailForInvoice,
} from "./email.js";
import { z } from "zod";
import Stripe from "stripe";
import { registerQuestionsRoutes } from "./routes/questions.js";
import { registerAttemptsRoutes } from "./routes/attempts.js";
import { registerRedZonesRoutes } from "./routes/red-zones.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import {
  buildCheckoutSessionParams,
  resolveCheckoutReturnUrls,
} from "./checkout.js";
import {
  CohortCapacityFullError,
  CohortCapacityUnavailableError,
  enforceCheckoutCapacityOpen,
} from "./lib/capacity.js";
import {
  runStripeEventWithAudit,
  summarizeStripeWebhookError,
  type StripeEventAuditCompletion,
} from "./lib/stripe-event-audit.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerMeRedZonesRoutes } from "./routes/me-red-zones.js";
import { registerMeGamificationRoutes } from "./routes/me-gamification.js";
import { registerMeTrapsRoutes } from "./routes/me-traps.js";
import { registerTrapsRoutes } from "./routes/traps.js";
import { registerBootCampsRoutes } from "./routes/boot-camps.js";
import { registerDrillsRoutes } from "./routes/drills.js";
import { registerTensionsRoutes } from "./routes/tensions.js";
import { registerFoundationsRoutes } from "./routes/foundations.js";
import { registerC3Routes } from "./routes/c3.js";
import { registerC3CoachRoutes } from "./routes/c3-coach.js";
import { registerCertificationRoutes } from "./routes/certification.js";
import { registerPlacementDiagnosticRoutes } from "./routes/placement-diagnostic.js";
import {
  requireEnrollment,
  resolveOwnedBillingPortalCustomer,
} from "./lib/clerk-entitlement.js";
import { recoverBillingCustomerFromCheckoutSession } from "./lib/billing-portal.js";
import {
  computeDiagnosticResults,
  selectDiagnosticQuestionIds,
  DIAGNOSTIC_LENGTH,
  DIAGNOSTIC_POOL_SIZE,
  type DiagnosticAttemptRow,
  type DiagnosticCandidate,
} from "./lib/diagnostic.js";

// Module-scoped Stripe client — cheaper than instantiating per request.
const stripeClient = new Stripe(config.stripe.secretKey);

/**
 * Idempotent 2-pay subscription arming. If a subscription already exists
 * for this checkout session (identified by metadata.first_session_id), it
 * is returned. Otherwise, a fresh $0 anchor subscription is created with
 * billing_cycle_anchor = day 30, cancel_at = day 60, default_payment_method
 * set, and a pending $499 InvoiceItem attached.
 */
async function armTwoPaySubscription(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!customerId || !paymentIntentId) {
    console.error(
      `[stripe webhook] two-pay arming: session missing customer/payment_intent`,
      { sessionId: session.id, customerId, paymentIntentId },
    );
    return null;
  }

  // Idempotency: look for an existing subscription tagged with this session.
  const existing = await stripeClient.subscriptions.list({
    customer: customerId,
    limit: 10,
  });
  const reused = existing.data.find(
    (s) => s.metadata?.first_session_id === session.id,
  );
  if (reused) {
    console.log(
      `[stripe webhook] two-pay arming: reusing sub=${reused.id} for session=${session.id}`,
    );
    return reused.id;
  }

  const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  const paymentMethodId =
    typeof pi.payment_method === "string"
      ? pi.payment_method
      : (pi.payment_method?.id ?? null);
  if (!paymentMethodId) {
    throw new Error(
      `two-pay arming: no payment_method on payment_intent ${paymentIntentId}`,
    );
  }

  await stripeClient.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const now = Math.floor(Date.now() / 1000);
  const day30 = now + 30 * 86400;
  const day60 = now + 60 * 86400;

  const sub = await stripeClient.subscriptions.create({
    customer: customerId,
    items: [{ price: config.stripe.priceFlagshipAnchor }],
    default_payment_method: paymentMethodId,
    billing_cycle_anchor: day30,
    proration_behavior: "none",
    cancel_at: day60,
    metadata: {
      payment_plan: "two_pay_500_499",
      first_session_id: session.id,
      cohort_code: config.cohort.code,
    },
  });

  await stripeClient.invoiceItems.create({
    customer: customerId,
    price: config.stripe.pricePayInTwoSecond,
    subscription: sub.id,
  });

  console.log(
    `[stripe webhook] two-pay armed: sub=${sub.id} customer=${customerId} day30=${day30} day60=${day60}`,
  );
  return sub.id;
}

interface CohortStatusRow {
  cohort_code: string;
  public_status: CohortPublicStatus;
  public_copy: string;
}

// n>=30 focus-group sample gate (SRC-0007 CLAIMS_SIGNOFF) — only questions with
// a publishable distractor signal contribute attractiveness to selection.
const DIAGNOSTIC_FOCUS_GROUP_MIN_SAMPLE = 30;
const DIAGNOSTIC_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DiagnosticCandidateRow {
  question_id: string;
  subject: string | null;
  attractiveness: number | string | null;
}

interface DiagnosticAttemptQueryRow {
  correct: boolean | 0 | 1;
  confidence: number | null;
  time_seconds: number | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
  selected_forensic_tags: unknown;
}

interface BodyParseError extends Error {
  status?: number;
  type?: string;
}

function isBodyParseError(err: Error): err is BodyParseError {
  const maybe = err as BodyParseError;
  return maybe.status === 400 && maybe.type === "entity.parse.failed";
}

// Tolerant JSON-array parse — mysql2 may hand back forensic_tags as a JSON
// string or an already-parsed array depending on column/driver config.
function parseStringArray(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

const app = express();
const sentryEnabled = isSentryEnabled();

// Stripe webhook needs the raw body for signature verification —
// register that route BEFORE express.json() globally consumes the stream.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature header");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        signature,
        config.stripe.webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error("[stripe webhook] signature verification failed:", msg);
      res.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    console.log(`[stripe webhook] ${event.type} ${event.id}`);

    try {
      const audit = await runStripeEventWithAudit({
        event,
        handleEvent: handleStripeWebhookEvent,
      });
      if (audit.status === "in_progress") {
        res.status(409).json({ error: "webhook event already processing" });
        return;
      }
      if (audit.status === "replayed") {
        res.json({ received: true, replay: true });
        return;
      }
    } catch (err) {
      // Return 500 so Stripe retries delivery. Idempotency guards in
      // the event audit store and fulfillment handlers prevent
      // double-application.
      console.error(
        `[stripe webhook] handler failed for ${event.type} ${event.id}: ${summarizeStripeWebhookError(err)}`,
      );
      res.status(500).json({ error: "webhook handler failed" });
      return;
    }

    res.json({ received: true });
  },
);

async function handleStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeEventAuditCompletion> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      let subscriptionId: string | null = null;

      // For 2-pay, the subscription must be armed BEFORE we record the
      // purchase so the stripe_subscription_id is populated.
      if (session.metadata?.payment_plan === "two_pay_500_499") {
        subscriptionId = await armTwoPaySubscription(session);
      } else if (typeof session.subscription === "string") {
        subscriptionId = session.subscription;
      } else if (
        session.subscription &&
        typeof session.subscription === "object"
      ) {
        subscriptionId = session.subscription.id;
      }

      const fulfillment = await fulfillCheckoutSession({
        session,
        subscriptionId,
      });
      await sendEnrollmentEmailForFulfillment({ session, fulfillment });
      return {
        processingStatus: "processed",
        relatedPurchaseId: fulfillment.purchaseId,
        relatedStudentId: fulfillment.studentId,
      };
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const { recorded } = await recordInstallmentPayment(invoice);
      await sendInstallmentReceiptForInvoice({ invoice, recorded });
      return { processingStatus: "processed" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const { suspended } = await suspendEntitlement(invoice);
      await sendPaymentFailedEmailForInvoice({ invoice, suspended });
      return { processingStatus: "processed" };
    }

    case "invoice.upcoming": {
      const invoice = event.data.object as Stripe.Invoice;
      await sendUpcomingPaymentEmailForInvoice({ invoice });
      return { processingStatus: "processed" };
    }

    default:
      // payment_intent.* and other events are observed but require no domain
      // action. Audit them as ignored and return 200.
      return { processingStatus: "ignored" };
  }
}

// Standard middleware for the rest of the API.
app.use(helmet());
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.vary("Origin");
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// ----- health -----
app.get("/health", async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, db: "up" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "down", error: String(err) });
  }
});

// ----- cohort capacity -----
app.get("/api/cohort/status", async (_req, res) => {
  try {
    const { rows } = await getPool().query<CohortStatusRow>(
      "SELECT cohort_code, public_status, public_copy FROM cohort_public_status WHERE cohort_code = $1 LIMIT 1",
      [config.cohort.code],
    );
    const row = rows[0];
    if (!row) {
      res.json({
        cohort_code: config.cohort.code,
        public_status: "open" as CohortPublicStatus,
        public_copy: CAPACITY_COPY.open,
      });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[cohort status] failed:", err);
    res.json({
      cohort_code: config.cohort.code,
      public_status: "open" as CohortPublicStatus,
      public_copy: CAPACITY_COPY.open,
    });
  }
});

// ----- diagnostic (skeleton) -----
const startDiagnosticBody = z.object({
  email: z.string().email().optional(),
  jurisdiction: z.string().max(64).optional(),
  partner_id: z.string().uuid().optional(),
  seen_question_ids: z.array(z.string().uuid()).max(500).optional(),
});

app.post("/api/diagnostic/start", async (req, res) => {
  const parse = startDiagnosticBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  // The diagnostic_id is the set_id we tag every diagnostic-mode attempt with
  // in student_attempts (via the `set_id` column). It is generated server-side
  // so partner attribution and tracking can attach immediately even before the
  // student creates an account.
  const diagnosticId = randomUUID();

  // Pull a trap-weighted candidate pool, then pick the diagnostic set with
  // subject spread. "Attractiveness" = the most-chosen WRONG distractor's
  // focus-group pct (n>=30, correct letter excluded). Questions without that
  // signal sort last via RAND(), so when no focus-group data exists selection
  // degrades to a random pick — no regression from the prior behavior.
  const seen = parse.data.seen_question_ids ?? [];
  const seenExclusion =
    seen.length > 0
      ? `AND q.question_id NOT IN (${seen.map((_: string, i: number) => `$${i + 3}`).join(", ")})`
      : "";
  let questionIds: string[] = [];
  let bankLoaded = false;
  try {
    const { rows } = await getPool().query<DiagnosticCandidateRow>(
      `SELECT q.question_id, q.subject,
              CASE
                WHEN fg.sample_size >= $1 THEN GREATEST(
                  CASE WHEN cc.letter = 'A' THEN -1 ELSE COALESCE(fg.pct_a, 0) END,
                  CASE WHEN cc.letter = 'B' THEN -1 ELSE COALESCE(fg.pct_b, 0) END,
                  CASE WHEN cc.letter = 'C' THEN -1 ELSE COALESCE(fg.pct_c, 0) END,
                  CASE WHEN cc.letter = 'D' THEN -1 ELSE COALESCE(fg.pct_d, 0) END
                )
                ELSE 0
              END AS attractiveness
         FROM questions q
         LEFT JOIN focus_group_response_data fg ON fg.question_id = q.question_id
         LEFT JOIN answer_choices cc
           ON cc.question_id = q.question_id AND cc.is_correct = 1
        WHERE q.status = 'active'
          ${seenExclusion}
        ORDER BY attractiveness DESC, RAND()
        LIMIT $2`,
      [DIAGNOSTIC_FOCUS_GROUP_MIN_SAMPLE, DIAGNOSTIC_POOL_SIZE, ...seen],
    );
    const candidates: DiagnosticCandidate[] = rows.map((r) => ({
      question_id: r.question_id,
      subject: r.subject ?? null,
      attractiveness: Number(r.attractiveness) || 0,
    }));
    questionIds = selectDiagnosticQuestionIds(candidates, DIAGNOSTIC_LENGTH);
    bankLoaded = questionIds.length > 0;
  } catch (err) {
    console.error("[diagnostic start] question pick failed:", err);
    // Fall through with empty list; the response shape stays valid.
  }

  res.json({
    diagnostic_id: diagnosticId,
    question_ids: questionIds,
    total_questions: questionIds.length,
    expected_total: DIAGNOSTIC_LENGTH,
    bank_loaded: bankLoaded,
    next_question_index: 0,
  });
});

// ----- diagnostic results (anonymous-safe Red-Zone preview) -----
// Aggregate one diagnostic session's attempts (grouped by set_id = the
// diagnostic id) into a score summary + computed Red-Zone preview. Computed on
// the fly and NEVER written to user_red_zones — that persistent surface stays
// gated to identified/enrolled students. Works for anonymous takers (no
// student_id) because attempts are keyed only by set_id.
app.get("/api/diagnostic/:id/results", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (typeof id !== "string" || !DIAGNOSTIC_ID_RE.test(id)) {
    res.status(400).json({ error: "invalid diagnostic id" });
    return;
  }
  try {
    const { rows } = await getPool().query<DiagnosticAttemptQueryRow>(
      `SELECT a.correct, a.confidence, a.time_seconds,
              q.subject, q.subtopic, q.tension_point,
              ac.forensic_tags AS selected_forensic_tags
         FROM student_attempts a
         JOIN questions q ON q.question_id = a.question_id
         LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
        WHERE a.set_id = $1
        ORDER BY a.attempted_at ASC`,
      [id],
    );
    const attempts: DiagnosticAttemptRow[] = rows.map((r) => ({
      correct: r.correct,
      confidence: r.confidence,
      time_seconds: r.time_seconds,
      subject: r.subject,
      subtopic: r.subtopic,
      tension_point: r.tension_point,
      selected_forensic_tags: parseStringArray(r.selected_forensic_tags),
    }));
    res.json({ diagnostic_id: id, ...computeDiagnosticResults(attempts) });
  } catch (err) {
    console.error("[diagnostic results] failed:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

// ----- question flow (Hearsay seam) -----
// Real handlers live in src/routes/*. The placeholders that used to sit here
// (returning fixed strings) were replaced after Handoff 10 wired the DB-backed
// implementations against the Hearsay seed.
registerQuestionsRoutes(app);
registerAttemptsRoutes(app);
registerRedZonesRoutes(app);
registerKnowledgeRoutes(app);
registerMeRoutes(app);
registerMeRedZonesRoutes(app);
registerMeGamificationRoutes(app);
registerMeTrapsRoutes(app);
registerTrapsRoutes(app);
registerBootCampsRoutes(app);
registerDrillsRoutes(app);
registerTensionsRoutes(app);
registerFoundationsRoutes(app);
registerC3Routes(app);
registerC3CoachRoutes(app);
registerCertificationRoutes(app);
registerPlacementDiagnosticRoutes(app);

// ----- checkout -----
const checkoutBody = z.object({
  product_code: z.literal("barmatrix_flagship_999").optional(),
  payment_plan: z.enum(["pay_in_full", "two_pay_500_499"]),
  partner_id: z.string().uuid().nullable().optional(),
  referral_click_id: z.string().uuid().nullable().optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

app.post("/api/checkout/create-session", async (req, res) => {
  const parse = checkoutBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const metadata = {
    cohort_code: config.cohort.code,
    partner_id: parse.data.partner_id ?? "",
    referral_click_id: parse.data.referral_click_id ?? "",
    payment_plan: parse.data.payment_plan,
  };

  // ---- Cohort capacity gate ----
  // RULES.md locks an internal cap of 1,000 students for the July cohort.
  // Don't let Stripe Checkout open for a customer who can't actually get a
  // seat. DB failures fail closed; fulfillment repeats the cap check under
  // a transaction lock before assigning a seat.
  try {
    await enforceCheckoutCapacityOpen(getPool(), config.cohort.code);
  } catch (err) {
    if (err instanceof CohortCapacityFullError) {
      // Public copy per DRIFT_CONTROL.md "waitlist" band.
      res.status(409).json({
        error: "cohort_full",
        public_copy: "Cohort capacity reached. Join the waitlist.",
      });
      return;
    }
    if (err instanceof CohortCapacityUnavailableError) {
      console.error("[checkout] capacity check failed closed:", err.name);
    } else {
      console.error("[checkout] capacity check failed closed: unknown");
    }
    res.status(503).json({ error: "cohort_capacity_unavailable" });
    return;
  }

  try {
    const { successUrl, cancelUrl } = resolveCheckoutReturnUrls(parse.data, {
      frontendUrl: config.urls.frontend,
      checkoutSuccess: config.urls.checkoutSuccess,
      checkoutCancel: config.urls.checkoutCancel,
      nodeEnv: config.nodeEnv,
    });

    const sessionParams = buildCheckoutSessionParams({
      paymentPlan: parse.data.payment_plan,
      metadata,
      successUrl,
      cancelUrl,
      pricePayInFull: config.stripe.pricePayInFull,
      pricePayInTwo: config.stripe.pricePayInTwo,
    });

    const session = await stripeClient.checkout.sessions.create(sessionParams);
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[checkout] failed:", err);
    res.status(500).json({ error: "checkout session creation failed" });
  }
});

// ----- billing portal -----
// Contract: API_CONTRACTS.md "POST /api/billing/create-portal-session".
// Clerk auth plus local purchase ownership are required before any Stripe
// session recovery; a provider-side session ID alone is not proof of ownership.
const portalBody = z.object({
  checkout_session_id: z.string().min(1).nullable().optional(),
  return_url: z.string().url(),
});

app.post("/api/billing/create-portal-session", ...requireEnrollment(), async (req, res) => {
  const parse = portalBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { checkout_session_id: checkoutSessionId, return_url: returnUrl } =
    parse.data;

  let ownership;
  try {
    ownership = await resolveOwnedBillingPortalCustomer({
      studentId: res.locals.enrolledStudentId,
      checkoutSessionId,
    }, getPool(), (purchase) =>
      recoverBillingCustomerFromCheckoutSession(purchase, {
        checkoutSessions: stripeClient.checkout.sessions,
      }),
    );
  } catch (err) {
    console.error("[billing portal] purchase lookup failed:", err);
    res.status(500).json({ error: "internal server error" });
    return;
  }

  if (ownership.status !== "ok") {
    if (ownership.status === "unauthenticated") {
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    if (ownership.status === "forbidden") {
      res.status(403).json({ error: "billing portal forbidden" });
      return;
    }
    res.status(404).json({ error: "no local billing purchase found" });
    return;
  }

  try {
    const portal = await stripeClient.billingPortal.sessions.create({
      customer: ownership.customerId,
      return_url: returnUrl,
    });
    res.json({ portal_url: portal.url, session_id: portal.id });
  } catch (err) {
    console.error("[billing portal] stripe portal create failed:", err);
    res.status(502).json({ error: "could not create billing portal session" });
  }
});

// ----- referrals -----
const clickBody = z.object({
  partner_code: z.string().min(1).max(64),
  campaign_id: z.string().max(128).optional(),
  utm_source: z.string().max(128).optional(),
  utm_medium: z.string().max(128).optional(),
  utm_campaign: z.string().max(128).optional(),
  visitor_id: z.string().max(255).optional(),
  landing_page: z.string().max(512).optional(),
});

app.post("/api/referrals/click", async (req, res) => {
  const parse = clickBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  // TODO: resolve partner_code → partner_id, insert into referral_clicks.
  res.json({ referral_click_id: "00000000-0000-0000-0000-000000000000" });
});

// ----- 404 + error handlers -----
setupSentryErrorHandler(app, sentryEnabled);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (isBodyParseError(err)) {
    res.status(400).json({ error: "invalid JSON body" });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal server error" });
});

// ----- start -----
app.listen(config.port, () => {
  console.log(
    `barmatrix-api listening on :${config.port} (${config.nodeEnv}) — ${config.allowedOrigins.length} allowed origins`,
  );
});
