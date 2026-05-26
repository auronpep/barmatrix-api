// BarMatrix API — Day 1 skeleton.
// Production target: Google Cloud Run at api.barmatrix.app (see ADR 0004).
// Contracts: BARMATRIX/engineering/API_CONTRACTS.md (SRC-0020)
// Schema:    BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql (Postgres canonical)

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { getPool, ping } from "./db.js";
import { CAPACITY_COPY, type CohortPublicStatus } from "./copy.js";
import { z } from "zod";
import Stripe from "stripe";

interface CohortStatusRow {
  cohort_code: string;
  public_status: CohortPublicStatus;
  public_copy: string;
}

const app = express();

// Stripe webhook needs the raw body for signature verification —
// register that route BEFORE express.json() globally consumes the stream.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = new Stripe(config.stripe.secretKey);
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature header");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
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

    // TODO: persist the event, grant entitlement, assign cohort seat.
    // Skeleton: log and acknowledge.
    console.log(`[stripe webhook] ${event.type} ${event.id}`);
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
  // TODO: create a diagnostic session, attach partner attribution, return first question.
  res.json({
    diagnostic_id: "00000000-0000-0000-0000-000000000000",
    next_question_index: 0,
    total_questions: 12,
  });
});

// ----- attempts (skeleton) -----
const attemptBody = z.object({
  question_id: z.string().uuid(),
  selected_letter: z.enum(["A", "B", "C", "D"]),
  confidence: z.number().int().min(1).max(5),
  time_seconds: z.number().int().min(0),
  platform: z.enum(["web", "ios", "android"]).default("web"),
});

app.post("/api/attempts", async (req, res) => {
  const parse = attemptBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  // TODO: persist attempt, compute correctness, update red-zones, queue drill assignment.
  res.json({
    attempt_id: "00000000-0000-0000-0000-000000000000",
    correct: false,
    correct_answer: "D",
    forensics_url: "/api/attempts/00000000-0000-0000-0000-000000000000/forensics",
    red_zone_updates: [],
  });
});

app.get("/api/attempts/:id/forensics", async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: "invalid attempt id" });
    return;
  }
  // TODO: hydrate forensics from the selected wrong-answer choice + focus-group data.
  res.json({
    trap_name: "Purpose-of-offer hearsay trap",
    why_attractive:
      "The statement was made out of court, which makes the hearsay answer feel familiar.",
    why_wrong:
      "The statement is offered to show notice, not to prove the statement was true.",
    future_cue: "Ask why the statement is offered before hunting for an exception.",
    focus_group: { selected_choice_pct: 22, sample_size: 100 },
    assigned_drill: { name: "Hearsay Purpose-of-Offer Drill" },
  });
});

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
  const stripe = new Stripe(config.stripe.secretKey);
  const priceId =
    parse.data.payment_plan === "pay_in_full"
      ? config.stripe.pricePayInFull
      : config.stripe.pricePayInTwo;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: config.urls.checkoutSuccess,
      cancel_url: config.urls.checkoutCancel,
      metadata: {
        cohort_code: config.cohort.code,
        partner_id: parse.data.partner_id ?? "",
        referral_click_id: parse.data.referral_click_id ?? "",
        payment_plan: parse.data.payment_plan,
      },
    });
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
