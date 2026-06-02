import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import type express from "express";

import {
  getSentryDsn,
  initSentry,
  setupSentryErrorHandler,
  type SentryApi,
} from "./sentry.js";

function sentrySpy() {
  const calls: { init: unknown[]; setupExpressErrorHandler: unknown[] } = {
    init: [],
    setupExpressErrorHandler: [],
  };
  const sentry: SentryApi = {
    init(options) {
      calls.init.push(options);
      return undefined;
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
        sendDefaultPii: false,
        tracesSampleRate: 0,
      },
    ]);
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
      "node --import @sentry/node/preload dist/index.js",
    );
  });
});
