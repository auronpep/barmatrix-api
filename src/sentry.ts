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
    environment: env.NODE_ENV ?? "development",
    integrations: [sentry.expressIntegration()],
    sendDefaultPii: false,
    tracesSampleRate: 0,
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
