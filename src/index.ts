// BarMatrix API — Day 1 skeleton.
// Production target: Google Cloud Run at api.barmatrix.app (see ADR 0004).
// Contracts: BARMATRIX/engineering/API_CONTRACTS.md (SRC-0020)
// Schema:    BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql (Postgres canonical)

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { getPool, ping } from "./db.js";
import { CAPACITY_COPY, type CohortPublicStatus } from "./copy.js";
import {
  fulfillCheckoutSession,
  recordInstallmentPayment,
  suspendEntitlement,
} from "./entitlement.js";
import { z } from "zod";
import Stripe from "stripe";
import { registerQuestionsRoutes } from "./routes/questions.js";
import { registerAttemptsRoutes } from "./routes/attempts.js";
import { registerRedZonesRoutes } from "./routes/red-zones.js";

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

interface QuestionIdRow {
  question_id: string;
}

const DIAGNOSTIC_LENGTH = 12;

const app = express();

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

          await fulfillCheckoutSession({ session, subscriptionId });
          break;
        }

        case "invoice.payment_succeeded": {
          await recordInstallmentPayment(event.data.object as Stripe.Invoice);
          break;
        }

        case "invoice.payment_failed": {
          await suspendEntitlement(event.data.object as Stripe.Invoice);
          break;
        }

        default:
          // payment_intent.* and other events are observed but require no
          // domain action — Stripe gives us 200 either way.
          break;
      }
    } catch (err) {
      // Return 500 so Stripe retries delivery. Idempotency guards in
      // fulfillCheckoutSession / recordInstallmentPayment prevent
      // double-application.
      console.error(`[stripe webhook] handler failed for ${event.type} ${event.id}:`, err);
      res.status(500).json({ error: "webhook handler failed" });
      return;
    }

    res.json({ received: true });
  },
);

// Standard middleware for the rest of the API.
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed`));
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

  // Try to pull 12 active questions from the loaded bank. Until the 2,400-item
  // bank is ingested, this returns an empty array — the frontend should switch
  // to a "bank loading" copy variant when bank_loaded=false rather than try to
  // render placeholder UUIDs as real questions.
  let questionIds: string[] = [];
  let bankLoaded = false;
  try {
    const { rows } = await getPool().query<QuestionIdRow>(
      "SELECT question_id FROM questions WHERE status = 'active' ORDER BY RAND() LIMIT $1",
      [DIAGNOSTIC_LENGTH],
    );
    questionIds = rows.map((r) => r.question_id);
    bankLoaded = questionIds.length >= DIAGNOSTIC_LENGTH;
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

// ----- question flow (Hearsay seam) -----
// Real handlers live in src/routes/*. The placeholders that used to sit here
// (returning fixed strings) were replaced after Handoff 10 wired the DB-backed
// implementations against the Hearsay seed.
registerQuestionsRoutes(app);
registerAttemptsRoutes(app);
registerRedZonesRoutes(app);

// ----- checkout -----
const checkoutBody = z.object({
  payment_plan: z.enum(["pay_in_full", "two_pay_500_499"]),
  partner_id: z.string().uuid().nullable().optional(),
  referral_click_id: z.string().uuid().nullable().optional(),
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
  // seat. The cohort_public_status view already reports the right band; we
  // just enforce it on writes here. A tiny concurrent race (two creates at
  // count=999) can over-sell by 1-2 — acceptable per founder defaults.
  try {
    const capRes = await getPool().query<{
      internal_capacity: number;
      active_count: string;
    }>(
      `SELECT c.internal_capacity,
              COALESCE(COUNT(e.enrollment_id), 0) AS active_count
         FROM cohort_config c
         LEFT JOIN cohort_enrollments e
           ON e.cohort_id = c.cohort_id
          AND e.enrollment_status = 'active'
        WHERE c.cohort_code = $1 AND c.active = 1
        GROUP BY c.cohort_id, c.internal_capacity`,
      [config.cohort.code],
    );
    const capRow = capRes.rows[0];
    if (!capRow) {
      console.error(
        `[checkout] no active cohort_config row for code=${config.cohort.code}`,
      );
      res.status(503).json({ error: "cohort_unavailable" });
      return;
    }
    if (Number(capRow.active_count) >= capRow.internal_capacity) {
      // Public copy per DRIFT_CONTROL.md "waitlist" band.
      res.status(409).json({
        error: "cohort_full",
        public_copy: "Cohort capacity reached. Join the waitlist.",
      });
      return;
    }
  } catch (err) {
    // Fail-open is the wrong default for a capacity gate, but a DB outage
    // shouldn't block all checkout traffic indefinitely. Log loudly and let
    // the call through — the rare over-sell beats a blanket revenue cutoff.
    console.error("[checkout] capacity check failed, proceeding:", err);
  }

  try {
    // Both flows use Checkout in payment mode. Pay-in-full charges $999
    // one-time. Two-pay charges $500 now AND saves the card off_session so
    // the webhook handler can spin up a $0 anchor subscription that fires
    // the $499 second installment at day 30 and cancels at day 60.
    const sessionParams: Stripe.Checkout.SessionCreateParams =
      parse.data.payment_plan === "pay_in_full"
        ? {
            mode: "payment",
            line_items: [
              { price: config.stripe.pricePayInFull, quantity: 1 },
            ],
            success_url: config.urls.checkoutSuccess,
            cancel_url: config.urls.checkoutCancel,
            metadata,
          }
        : {
            mode: "payment",
            line_items: [
              { price: config.stripe.pricePayInTwo, quantity: 1 }, // $500
            ],
            customer_creation: "always",
            payment_intent_data: {
              setup_future_usage: "off_session",
              metadata,
            },
            success_url: config.urls.checkoutSuccess,
            cancel_url: config.urls.checkoutCancel,
            metadata,
          };
    const session = await stripeClient.checkout.sessions.create(sessionParams);
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[checkout] failed:", err);
    res.status(500).json({ error: "checkout session creation failed" });
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
app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal server error" });
});

// ----- start -----
app.listen(config.port, () => {
  console.log(
    `barmatrix-api listening on :${config.port} (${config.nodeEnv}) — ${config.allowedOrigins.length} allowed origins`,
  );
});
