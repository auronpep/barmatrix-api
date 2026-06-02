import type express from "express";
import * as Sentry from "@sentry/node";

export type SentryApi = Pick<
  typeof Sentry,
  "expressIntegration" | "init" | "isInitialized" | "setupExpressErrorHandler"
>;

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function getSentryDsn(env: Env = process.env): string | undefined {
  return env.BARMATRIX_API_SENTRY_DSN || env.SENTRY_DSN || undefined;
}

// Trial default: capture all traces to evaluate distributed/DB tracing.
// Override with SENTRY_TRACES_SAMPLE_RATE (0..1) and dial down post-trial.
const DEFAULT_TRACES_SAMPLE_RATE = 1.0;

export function resolveTracesSampleRate(env: Env = process.env): number {
  const raw = env.SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw === "") {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  return parsed;
}

export function initSentry(
  env: Env = process.env,
  sentry: SentryApi = Sentry,
): boolean {
  const dsn = getSentryDsn(env);
  if (!dsn) {
    return false;
  }

  sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "development",
    integrations: [sentry.expressIntegration()],
    sendDefaultPii: false,
    tracesSampleRate: resolveTracesSampleRate(env),
  });
  return true;
}

export function isSentryEnabled(sentry: SentryApi = Sentry): boolean {
  return sentry.isInitialized();
}

export function setupSentryErrorHandler(
  app: express.Express,
  enabled: boolean,
  sentry: SentryApi = Sentry,
): void {
  if (!enabled) {
    return;
  }
  sentry.setupExpressErrorHandler(app);
}
