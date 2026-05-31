import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Mirror the route-test env setup so config loads without touching real services.
process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_NAME = "test_db";
process.env.DATABASE_USER = "test_user";
process.env.DATABASE_PASSWORD = "test_password";
process.env.BARMATRIX_DB_KEY = "test_password";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP = "prod_placeholder";
process.env.STRIPE_PRICE_PAY_IN_FULL = "price_placeholder_full";
process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR = "price_placeholder_anchor";
process.env.STRIPE_PRICE_PAY_IN_TWO = "price_placeholder_two";
process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND = "price_placeholder_second";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const { registerBootCampsRoutes } = await import("./boot-camps.js");

type CapturedRoute = {
  method: "GET" | "POST";
  path: string;
  handlerCount: number;
};

function captureRoutes(register: (app: never) => void): CapturedRoute[] {
  const routes: CapturedRoute[] = [];
  const app = {
    get(path: string, ...handlers: unknown[]) {
      routes.push({ method: "GET", path, handlerCount: handlers.length });
      return app;
    },
    post(path: string, ...handlers: unknown[]) {
      routes.push({ method: "POST", path, handlerCount: handlers.length });
      return app;
    },
  };
  register(app as never);
  return routes;
}

describe("registerBootCampsRoutes auth guards", () => {
  it("gates paid boot-camp session reads and mutations with enrollment middleware", () => {
    const routes = captureRoutes(registerBootCampsRoutes as (app: never) => void);
    const protectedRoutes = [
      { method: "GET", path: "/api/boot-camps/sessions/:session_id" },
      { method: "POST", path: "/api/boot-camps/sessions/:session_id/days/:day/start" },
      { method: "POST", path: "/api/boot-camps/sessions/:session_id/days/:day/complete" },
      { method: "POST", path: "/api/boot-camps/sessions/:session_id/mastery/start" },
      { method: "POST", path: "/api/boot-camps/sessions/:session_id/mastery/complete" },
    ];

    for (const expected of protectedRoutes) {
      const route = routes.find(
        (candidate) =>
          candidate.method === expected.method && candidate.path === expected.path,
      );
      assert.ok(route, `${expected.method} ${expected.path} is registered`);
      assert.equal(
        route.handlerCount >= 3,
        true,
        `${expected.method} ${expected.path} includes enrollment middleware`,
      );
    }
  });
});
