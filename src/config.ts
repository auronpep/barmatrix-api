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

export const config = {
  port: Number(optional("PORT", "3000")),
  nodeEnv: optional("NODE_ENV", "development"),
  allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  db: {
    host: required("DATABASE_HOST"),
    port: Number(optional("DATABASE_PORT", "3306")),
    database: required("DATABASE_NAME"),
    user: required("DATABASE_USER"),
    password: required("DATABASE_PASSWORD"),
  },

  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    productFlagship: required("STRIPE_PRODUCT_BARMATRIX_FLAGSHIP"),
    pricePayInFull: required("STRIPE_PRICE_PAY_IN_FULL"),
    pricePayInTwo: required("STRIPE_PRICE_PAY_IN_TWO"),
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
