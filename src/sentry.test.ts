import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import type express from "express";

import {
  getSentryDsn,
  initSentry,
  isSentryEnabled,
  setupSentryErrorHandler,
  type SentryApi,
} from "./sentry.js";

function sentrySpy(initialized = false) {
  const expressIntegration = { name: "Express" };
  const calls: {
    expressIntegration: unknown[];
    init: unknown[];
    setupExpressErrorHandler: unknown[];
  } = {
    expressIntegration: [],
    init: [],
    setupExpressErrorHandler: [],
  };
  const sentry: SentryApi = {
    expressIntegration() {
      calls.expressIntegration.push(undefined);
      return expressIntegration;
    },
    init(options) {
      calls.init.push(options);
      return undefined;
    },
    isInitialized() {
      return initialized;
    },
    setupExpressErrorHandler(app) {
      calls.setupExpressErrorHandler.push(app);
    },
  };
  return { calls, sentry };
}

describe("Sentry API wiring", () => {
  it("uses the BarMatrix API DSN alias before the generic Sentry DSN", () => {
    assert.equal(
      getSentryDsn({
        BARMATRIX_API_SENTRY_DSN: "api-dsn",
        SENTRY_DSN: "generic-dsn",
      }),
      "api-dsn",
    );
  });

  it("does not initialize or install an Express handler without a DSN", () => {
    const { calls, sentry } = sentrySpy();

    const enabled = initSentry({}, sentry);
    setupSentryErrorHandler({} as express.Express, enabled, sentry);

    assert.equal(enabled, false);
    assert.deepEqual(calls.init, []);
    assert.deepEqual(calls.setupExpressErrorHandler, []);
  });

  it("initializes with privacy-conservative defaults when a DSN is present", () => {
    const { calls, sentry } = sentrySpy();

    const enabled = initSentry(
      {
        BARMATRIX_API_SENTRY_DSN: "api-dsn",
        NODE_ENV: "production",
      },
      sentry,
    );

    assert.equal(enabled, true);
    assert.deepEqual(calls.init, [
      {
        dsn: "api-dsn",
        environment: "production",
        integrations: [{ name: "Express" }],
        sendDefaultPii: false,
        tracesSampleRate: 0,
      },
    ]);
    assert.deepEqual(calls.expressIntegration, [undefined]);
  });

  it("reports whether the SDK was initialized by the preload entry", () => {
    assert.equal(isSentryEnabled(sentrySpy(false).sentry), false);
    assert.equal(isSentryEnabled(sentrySpy(true).sentry), true);
  });

  it("lets SENTRY_ENVIRONMENT override NODE_ENV so local boxes don't report as prod", () => {
    const { calls, sentry } = sentrySpy();

    initSentry(
      {
        BARMATRIX_API_SENTRY_DSN: "api-dsn",
        NODE_ENV: "production",
        SENTRY_ENVIRONMENT: "local",
      },
      sentry,
    );

    assert.equal((calls.init[0] as { environment: string }).environment, "local");
  });

  it("installs the Express error handler only after Sentry is enabled", () => {
    const { calls, sentry } = sentrySpy();
    const app = {} as express.Express;

    setupSentryErrorHandler(app, true, sentry);

    assert.deepEqual(calls.setupExpressErrorHandler, [app]);
  });

  it("preloads Sentry instrumentation before the production app starts", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts?: { start?: string } };

    assert.equal(
      packageJson.scripts?.start,
      "node --import ./dist/sentry-init.js dist/index.js",
    );
  });
});
