// Centralized config — fail loud at boot if a required env var is missing,
// so we never deploy a half-configured backend that silently degrades.

import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000";

function originList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowedOrigins(): string[] {
  return [...new Set([
    ...originList(DEFAULT_ALLOWED_ORIGINS),
    ...originList(process.env.ALLOWED_ORIGINS),
  ])];
}

export const config = {
  port: Number(optional("PORT", "3000")),
  nodeEnv: optional("NODE_ENV", "development"),
  allowedOrigins: allowedOrigins(),

  db: {
    host: optional("DATABASE_HOST", "localhost"),
    port: Number(optional("DATABASE_PORT", "3306")),
    database: required("DATABASE_NAME"),
    user: required("DATABASE_USER"),
    password: required("BARMATRIX_DB_KEY"),
  },

  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    productFlagship: required("STRIPE_PRODUCT_BARMATRIX_FLAGSHIP"),
    // Pay-in-full: a single one-time price object that Checkout charges in
    // `mode: "payment"`.
    pricePayInFull: required("STRIPE_PRICE_PAY_IN_FULL"),
    // 2-pay plan ("two_pay_500_499") uses Stripe Subscription with three
    // price objects, per ADR 0004 § Pattern X:
    //   - priceFlagshipAnchor: $0/month recurring, the required "anchor" so
    //     Stripe will schedule a 30-day billing cycle for the second invoice.
    //   - pricePayInTwo: $500 one-time, added via `subscription_data.add_invoice_items`
    //     on the FIRST invoice (charged at checkout completion = day 0).
    //   - pricePayInTwoSecond: $499 one-time, attached as a pending
    //     InvoiceItem in the webhook handler so it auto-includes on the
    //     subscription's next invoice (day 30). The subscription is set to
    //     cancel_at = day 60 so no further invoices fire.
    priceFlagshipAnchor: required("STRIPE_PRICE_FLAGSHIP_ANCHOR"),
    pricePayInTwo: required("STRIPE_PRICE_PAY_IN_TWO"),
    pricePayInTwoSecond: required("STRIPE_PRICE_PAY_IN_TWO_SECOND"),
  },

  clerk: {
    publishableKey: required("CLERK_PUBLISHABLE_KEY"),
    secretKey: required("CLERK_SECRET_KEY"),
  },

  urls: {
    frontend: required("FRONTEND_URL"),
    checkoutSuccess: required("SUCCESS_URL"),
    checkoutCancel: required("CANCEL_URL"),
  },

  cohort: {
    code: "JULY_MBE_REPAIR",
    priceCents: 99900,
    payInFullCents: 99900,
    payInTwoTotalCents: 99900,
    // Internal — never exposed in API responses.
    internalCapacity: 1000,
  },
} as const;
