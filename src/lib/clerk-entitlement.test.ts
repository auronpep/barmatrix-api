import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Mirror the env setup from drills.test.ts so the module tree loads cleanly.
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
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
process.env.FRONTEND_URL = "https://barmatrix.app";
process.env.SUCCESS_URL = "https://barmatrix.app/account/?welcome=1";
process.env.CANCEL_URL = "https://barmatrix.app/pricing/";

const {
  createEnrollmentCheckHandler,
  isEnrolled,
  requireEnrolledResourceOwner,
} = await import("./clerk-entitlement.js");

function mockResponse() {
  return {
    locals: {} as Record<string, unknown>,
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

describe("isEnrolled", () => {
  it("returns true when one purchase is active with no refund", () => {
    assert.equal(
      isEnrolled([{ entitlement_status: "active", refund_status: "none" }]),
      true,
    );
  });

  it("returns false when purchase is suspended", () => {
    assert.equal(
      isEnrolled([{ entitlement_status: "suspended", refund_status: "none" }]),
      false,
    );
  });

  it("returns false when purchase is refunded", () => {
    assert.equal(
      isEnrolled([{ entitlement_status: "active", refund_status: "full" }]),
      false,
    );
  });

  it("returns false with an empty purchase list", () => {
    assert.equal(isEnrolled([]), false);
  });

  it("returns true when at least one of multiple purchases is active", () => {
    assert.equal(
      isEnrolled([
        { entitlement_status: "suspended", refund_status: "none" },
        { entitlement_status: "active", refund_status: "none" },
      ]),
      true,
    );
  });
});

describe("createEnrollmentCheckHandler", () => {
  it("returns 401 when a paid study route has no Clerk session", async () => {
    const handler = createEnrollmentCheckHandler({
      getAuthForRequest: () => ({ userId: null }),
      checkEnrollmentForUser: async () => {
        throw new Error("should not run without a user");
      },
    });
    const res = mockResponse();
    let nextCalled = false;

    await handler({} as never, res as never, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: "not authenticated" });
    assert.equal(nextCalled, false);
  });

  it("returns 403 when a signed-in student is not enrolled", async () => {
    const handler = createEnrollmentCheckHandler({
      getAuthForRequest: () => ({ userId: "user_unenrolled" }),
      checkEnrollmentForUser: async () => ({
        studentId: "student_unenrolled",
        enrolled: false,
      }),
    });
    const res = mockResponse();
    let nextCalled = false;

    await handler({} as never, res as never, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "enrollment required" });
    assert.equal(nextCalled, false);
  });

  it("attaches the enrolled student id and continues for authorized access", async () => {
    const handler = createEnrollmentCheckHandler({
      getAuthForRequest: () => ({ userId: "user_enrolled" }),
      checkEnrollmentForUser: async () => ({
        studentId: "student_owner",
        enrolled: true,
      }),
    });
    const res = mockResponse();
    let nextCalled = false;

    await handler({} as never, res as never, () => {
      nextCalled = true;
    });

    assert.equal(res.locals.enrolledStudentId, "student_owner");
    assert.equal(res.statusCode, 200);
    assert.equal(nextCalled, true);
  });
});

describe("requireEnrolledResourceOwner", () => {
  it("returns 403 when a paid study resource belongs to another student", () => {
    const res = mockResponse();

    const allowed = requireEnrolledResourceOwner(res as never, "student_other");

    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: "resource forbidden" });
  });

  it("allows access when the paid study resource owner matches the enrolled student", () => {
    const res = mockResponse();
    res.locals.enrolledStudentId = "student_owner";

    const allowed = requireEnrolledResourceOwner(res as never, "student_owner");

    assert.equal(allowed, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, null);
  });
});
