// BarMatrix API — Day 1 skeleton.
// Production target: Google Cloud Run at api.barmatrix.app (see ADR 0004).
// Contracts: BARMATRIX/engineering/API_CONTRACTS.md (SRC-0020)
// Schema:    BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql (Postgres canonical)

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { config } from "./config.js";
import { initSentry, isSentryEnabled, setupSentryErrorHandler } from "./sentry.js";
import { handleListenError } from "./lib/listen.js";
import { getPool, ping, type DbPool } from "./db.js";
import {
  CAPACITY_COPY,
  publicCopyForCohortStatus,
  type CohortPublicStatus,
} from "./copy.js";
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
import { registerAnswerKeyRoutes } from "./routes/answer-key.js";
import { registerAttemptsRoutes } from "./routes/attempts.js";
import { registerAttemptFeedbackRoutes } from "./routes/attempt-feedback.js";
import { registerRedZonesRoutes } from "./routes/red-zones.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import {
  buildCheckoutSessionParams,
  isAllowedReturnUrl,
  resolveCheckoutReturnUrls,
} from "./checkout.js";
import { armTwoPaySubscription } from "./lib/two-pay.js";
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
import { registerMeDayPlanRoutes } from "./routes/me-day-plan.js";
import { registerMeRedZonesRoutes } from "./routes/me-red-zones.js";
import { registerMeConfusionRoutes } from "./routes/me-confusion.js";
import { registerCommandDeckRoutes } from "./routes/me-command-deck.js";
import { registerMeGamificationRoutes } from "./routes/me-gamification.js";
import { registerMeTrapsRoutes } from "./routes/me-traps.js";
import { registerTrapsRoutes } from "./routes/traps.js";
import { registerBootCampsRoutes } from "./routes/boot-camps.js";
import { registerDrillsRoutes } from "./routes/drills.js";
import { registerTensionsRoutes } from "./routes/tensions.js";
import { registerFoundationsRoutes } from "./routes/foundations.js";
import { registerPathRoutes } from "./routes/path.js";
import { registerFlashcardsRoutes } from "./routes/flashcards.js";
import { registerDoctrinalRoutes } from "./routes/doctrinal.js";
import { registerMiniDrillRoutes } from "./routes/mini-drill.js";
import { registerC3Routes } from "./routes/c3.js";
import { registerC3CoachRoutes } from "./routes/c3-coach.js";
import { registerAdminC3Routes } from "./routes/admin-c3.js";
import { registerAdminAtlasV1Routes } from "./routes/admin-atlas-v1.js";
import { registerAtlasV1Routes } from "./routes/atlas-v1.js";
import { registerC3SubjectsRoutes } from "./routes/c3-subjects.js";
import { registerCertificationRoutes } from "./routes/certification.js";
import { registerPlacementDiagnosticRoutes } from "./routes/placement-diagnostic.js";
import { registerWebinarLeadRoutes } from "./routes/webinar-leads.js";
import { registerDiagnosticLeadRoutes } from "./routes/diagnostic-leads.js";
import { registerTrapNamingJobRoutes } from "./routes/trap-naming-job.js";
import { registerLeadMeRoutes } from "./routes/leadme.js";
import { registerStudentDebriefRoutes } from "./routes/student-debriefs.js";
import { registerDebriefIntelRoutes } from "./routes/debrief-intel.js";
import { registerOutlineAtlasRoutes } from "./routes/outline-atlas.js";
import {
  requireEnrollment,
  resolveOwnedBillingPortalCustomer,
} from "./lib/clerk-entitlement.js";
import { recoverBillingCustomerFromCheckoutSession } from "./lib/billing-portal.js";
import {
  computeDiagnosticResults,
  extractDiagnosticAnchors,
  redZoneDimensionsFromMetadata,
  DIAGNOSTIC_LENGTH,
  type DiagnosticAttemptRow,
} from "./lib/diagnostic.js";
import {
  buildFixedDiagnosticQuestionSelection,
  shapeDiagnosticRecommendation,
} from "./lib/ambassador-diagnostic.js";

// Production runs under LiteSpeed lsnode, which starts the entry file with
// NODE_OPTIONS=--require <logger> and does NOT honor the package.json
// `--import ./dist/sentry-init.js` preload. So initialize Sentry here as an
// idempotent fallback — config.js (imported above) has already loaded the
// Hostinger env, so the DSN is present. When the preload DID run (local
// `npm start`), isSentryEnabled() is already true and this is a no-op.
if (!isSentryEnabled()) {
  initSentry();
}

// Module-scoped Stripe client — cheaper than instantiating per request.
const stripeClient = new Stripe(config.stripe.secretKey);

interface CohortStatusRow {
  cohort_code: string;
  public_status: CohortPublicStatus;
  public_copy: string;
}

const DIAGNOSTIC_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DiagnosticAttemptQueryRow {
  question_id: string;
  correct: boolean | 0 | 1;
  confidence: number | null;
  time_seconds: number | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
  selected_forensic_tags: unknown;
  external_id: string | null;
  metadata: string | null;
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

function isMissingTableError(err: unknown): boolean {
  const maybe = err as { code?: string; errno?: number };
  return maybe.code === "ER_NO_SUCH_TABLE" || maybe.errno === 1146;
}

async function diagnosticResultsEmailGateSatisfied(
  db: Pick<DbPool, "query">,
  diagnosticId: string,
): Promise<boolean> {
  try {
    const { rows } = await db.query<{ ok: number }>(
      `SELECT 1 AS ok
         FROM diagnostic_leads
        WHERE diagnostic_id = $1
        LIMIT 1`,
      [diagnosticId],
    );
    return rows.length > 0;
  } catch (err) {
    if (isMissingTableError(err)) return false;
    throw err;
  }
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
      // Log the summarized (redacted, length-capped) message for a clean,
      // greppable line AND the raw error so the server log keeps the full stack
      // trace for debugging. Sentry below additionally captures the raw error.
      console.error(
        `[stripe webhook] handler failed for ${event.type} ${event.id}: ${summarizeStripeWebhookError(err)}`,
        err,
      );
      // Report to Sentry: this catch responds inline and never reaches the
      // Express error handler, so without this the most revenue-critical
      // failure (a webhook that can't fulfill a paid checkout) is invisible.
      Sentry.captureException(err, {
        tags: { area: "stripe_webhook", stripe_event_type: event.type },
        extra: { stripe_event_id: event.id },
      });
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
        subscriptionId = await armTwoPaySubscription(session, stripeClient);
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
    res.json({
      ...row,
      public_copy: publicCopyForCohortStatus(row.public_status),
    });
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

  // Ambassador launch diagnostic: fixed 20-question set in DIAG order. These
  // rows live at status='diagnostic' so they stay out of active practice pools.
  let questionIds: string[] = [];
  let bankLoaded = false;
  try {
    const selection = buildFixedDiagnosticQuestionSelection();
    const { rows } = await getPool().query<{ question_id: string }>(
      selection.sql,
      selection.values,
    );
    questionIds = rows.map((row) => row.question_id);
    bankLoaded = questionIds.length === DIAGNOSTIC_LENGTH;
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
    const db = getPool();
    const emailGateSatisfied = await diagnosticResultsEmailGateSatisfied(db, id);
    if (!emailGateSatisfied) {
      res.status(403).json({ error: "email gate required" });
      return;
    }

    // Dedupe to the LATEST attempt per question_id within this diagnostic
    // session. A student may submit a question more than once (double-submit,
    // retry, page-replay). Counting every row inflates `answered` and skews
    // the red-zone aggregation. The correlated MAX(attempted_at) subquery
    // keeps exactly one row per question — the most-recent outcome — and is
    // safe on MariaDB (no CAST AS JSON, no window functions required).
    const { rows } = await db.query<DiagnosticAttemptQueryRow>(
      `SELECT a.question_id,
              a.correct, a.confidence, a.time_seconds,
              q.subject, q.subtopic, q.tension_point,
              q.external_id, q.metadata,
              ac.forensic_tags AS selected_forensic_tags
         FROM student_attempts a
         JOIN questions q ON q.question_id = a.question_id
         LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
        WHERE a.set_id = $1
          AND a.attempted_at = (
            SELECT MAX(a2.attempted_at)
              FROM student_attempts a2
             WHERE a2.set_id = $1
               AND a2.question_id = a.question_id
          )
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
      red_zone_dimensions: redZoneDimensionsFromMetadata(r.metadata),
      selected_forensic_tags: parseStringArray(r.selected_forensic_tags),
    }));
    const results = computeDiagnosticResults(attempts);
    const anchors = extractDiagnosticAnchors(rows);
    res.json({
      diagnostic_id: id,
      ...results,
      anchors,
      recommendation: shapeDiagnosticRecommendation(results),
    });
  } catch (err) {
    console.error("[diagnostic results] failed:", err);
    Sentry.captureException(err, { tags: { area: "diagnostic_results" } });
    res.status(500).json({ error: "internal server error" });
  }
});

// ----- question flow (Hearsay seam) -----
// Real handlers live in src/routes/*. The placeholders that used to sit here
// (returning fixed strings) were replaced after Handoff 10 wired the DB-backed
// implementations against the Hearsay seed.
registerQuestionsRoutes(app);
registerAnswerKeyRoutes(app);
registerAttemptsRoutes(app);
registerAttemptFeedbackRoutes(app);
registerRedZonesRoutes(app);
registerKnowledgeRoutes(app);
registerMeRoutes(app);
registerMeDayPlanRoutes(app);
registerLeadMeRoutes(app);
registerStudentDebriefRoutes(app);
registerDebriefIntelRoutes(app);
registerOutlineAtlasRoutes(app);
registerMeRedZonesRoutes(app);
registerMeConfusionRoutes(app);
registerCommandDeckRoutes(app);
registerMeGamificationRoutes(app);
registerMeTrapsRoutes(app);
registerTrapsRoutes(app);
registerBootCampsRoutes(app);
registerDrillsRoutes(app);
registerTensionsRoutes(app);
registerFoundationsRoutes(app);
registerPathRoutes(app);
registerFlashcardsRoutes(app);
registerDoctrinalRoutes(app);
registerMiniDrillRoutes(app);
registerC3Routes(app);
registerC3CoachRoutes(app);
registerAtlasV1Routes(app);
registerAdminC3Routes(app);
registerAdminAtlasV1Routes(app);
registerC3SubjectsRoutes(app);
registerCertificationRoutes(app);
registerPlacementDiagnosticRoutes(app);
registerWebinarLeadRoutes(app);
registerDiagnosticLeadRoutes(app);
registerTrapNamingJobRoutes(app);

// ----- checkout -----
const checkoutBody = z.object({
  product_code: z.literal("barmatrix_flagship_999").optional(),
  payment_plan: z.enum(["pay_in_full", "two_pay_500_499"]),
  partner_id: z.string().uuid().nullable().optional(),
  referral_click_id: z.string().uuid().nullable().optional(),
  diagnostic_id: z.string().uuid().nullable().optional(),
  coupon_code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .nullable()
    .optional(),
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
    diagnostic_id: parse.data.diagnostic_id ?? "",
    payment_plan: parse.data.payment_plan,
    coupon_code: parse.data.coupon_code ?? "",
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
      res.status(409).json({
        error: "cohort_full",
        public_copy: CAPACITY_COPY.waitlist,
      });
      return;
    }
    if (err instanceof CohortCapacityUnavailableError) {
      console.error("[checkout] capacity check failed closed:", err.name);
    } else {
      console.error("[checkout] capacity check failed closed:", err);
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

    let promotionCodeId: string | undefined;
    const couponCode = parse.data.coupon_code?.trim();
    if (couponCode) {
      if (parse.data.payment_plan !== "pay_in_full") {
        res.status(400).json({
          error: "coupon_requires_pay_in_full",
          message: "Promotion codes are only available on pay-in-full checkout.",
        });
        return;
      }

      const promotionCodes = await stripeClient.promotionCodes.list({
        active: true,
        code: couponCode,
        limit: 1,
      });
      const promotionCode = promotionCodes.data[0];
      if (!promotionCode || !promotionCode.coupon.valid) {
        res.status(400).json({
          error: "invalid_coupon_code",
          message: "That promotion code is not active for checkout.",
        });
        return;
      }
      promotionCodeId = promotionCode.id;
      metadata.coupon_code = promotionCode.code;
    }

    const sessionParams = buildCheckoutSessionParams({
      paymentPlan: parse.data.payment_plan,
      metadata,
      successUrl,
      cancelUrl,
      pricePayInFull: config.stripe.pricePayInFull,
      pricePayInTwo: config.stripe.pricePayInTwo,
      promotionCodeId,
    });

    const session = await stripeClient.checkout.sessions.create(sessionParams);
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[checkout] failed:", err);
    // Inline catch never reaches the Express error handler — report directly
    // so a broken checkout-session creation surfaces in Sentry.
    Sentry.captureException(err, { tags: { area: "checkout" } });
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
  if (
    !isAllowedReturnUrl(returnUrl, {
      frontendUrl: config.urls.frontend,
      checkoutSuccess: config.urls.checkoutSuccess,
      checkoutCancel: config.urls.checkoutCancel,
      nodeEnv: config.nodeEnv,
    })
  ) {
    res.status(400).json({ error: "return_url is not allowed" });
    return;
  }

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
    Sentry.captureException(err, {
      tags: { area: "billing_portal", step: "purchase_lookup" },
    });
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
    Sentry.captureException(err, {
      tags: { area: "billing_portal", step: "stripe_portal_create" },
    });
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

  try {
    const pool = getPool();

    // Resolve partner_code to partner_id
    const partnerLookup = await pool.query<{ partner_id: string }>(
      "SELECT partner_id FROM partners WHERE partner_code = $1 LIMIT 1",
      [parse.data.partner_code],
    );
    if (partnerLookup.rows.length === 0) {
      console.warn(
        `[referrals] partner_code not found: ${parse.data.partner_code}`,
      );
      res.status(404).json({
        error: "partner_code_not_found",
        message: "The partner code was not recognized",
      });
      return;
    }
    const partnerId = partnerLookup.rows[0]!.partner_id;

    // Create referral click record with metadata
    const referralClickId = randomUUID();
    const metadata = {
      campaign_id: parse.data.campaign_id ?? null,
      utm_source: parse.data.utm_source ?? null,
      utm_medium: parse.data.utm_medium ?? null,
      utm_campaign: parse.data.utm_campaign ?? null,
      visitor_id: parse.data.visitor_id ?? null,
      landing_page: parse.data.landing_page ?? null,
      captured_at: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO referral_clicks (
         referral_click_id, partner_id, metadata
       )
       VALUES ($1, $2, $3)`,
      [referralClickId, partnerId, JSON.stringify(metadata)],
    );

    console.log(
      `[referrals] click recorded: referral_click_id=${referralClickId} partner_code=${parse.data.partner_code} partner_id=${partnerId}`,
    );

    res.json({ referral_click_id: referralClickId });
  } catch (err) {
    console.error("[referrals/click] failed:", err);
    Sentry.captureException(err, { tags: { area: "referrals_click" } });
    res.status(500).json({ error: "internal server error" });
  }
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
const server = app.listen(config.port, () => {
  console.log(
    `barmatrix-api listening on :${config.port} (${config.nodeEnv}) — ${config.allowedOrigins.length} allowed origins`,
  );
});
// Handle bind failures (e.g. EADDRINUSE) here so they exit cleanly instead of
// surfacing as a fatal uncaught exception in Sentry. See lib/listen.ts.
server.on("error", (err: NodeJS.ErrnoException) => {
  handleListenError(err, config.port);
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received; closing HTTP server and DB pool`);
  const forceExit = setTimeout(() => {
    console.error("[shutdown] timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  server.close(async (err) => {
    if (err) {
      console.error("[shutdown] server close failed:", err);
      Sentry.captureException(err, { tags: { area: "shutdown", step: "server_close" } });
    }
    try {
      await getPool().end();
      process.exit(err ? 1 : 0);
    } catch (poolErr) {
      console.error("[shutdown] pool close failed:", poolErr);
      Sentry.captureException(poolErr, { tags: { area: "shutdown", step: "pool_end" } });
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  Sentry.captureException(reason, { tags: { area: "process", kind: "unhandledRejection" } });
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  Sentry.captureException(err, { tags: { area: "process", kind: "uncaughtException" } });
  process.exit(1);
});
