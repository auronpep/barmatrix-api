import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCheckoutAccessLink,
  resolveClerkAccessConfig,
  type ClerkAccessClient,
} from "./clerk-access.js";

function configuredEnv(): Record<string, string> {
  return {
    CLERK_SECRET_KEY: "sk_test_placeholder",
    FRONTEND_URL: "https://barmatrix.app/",
  };
}

describe("Clerk checkout access invitations", () => {
  it("stays disabled when Clerk secret key is missing", async () => {
    let constructed = false;

    assert.equal(resolveClerkAccessConfig({}), null);

    const result = await createCheckoutAccessLink(
      {
        to: "student@example.com",
        firstName: "Student",
        lastName: "Example",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
        studentId: "student_123",
      },
      {
        env: {},
        createClient: () => {
          constructed = true;
          throw new Error("client should not be constructed");
        },
      },
    );

    assert.deepEqual(result, { status: "skipped", reason: "missing_config" });
    assert.equal(constructed, false);
  });

  it("skips when Stripe did not provide a customer email", async () => {
    const result = await createCheckoutAccessLink(
      {
        to: null,
        checkoutSessionId: "cs_test_123",
      },
      {
        env: configuredEnv(),
        createClient: () => {
          throw new Error("client should not be constructed");
        },
      },
    );

    assert.deepEqual(result, { status: "skipped", reason: "missing_recipient" });
  });

  it("creates a Clerk user and sign-in token for the checkout email", async () => {
    const calls: unknown[] = [];
    const client: ClerkAccessClient = {
      users: {
        getUserList: async (params) => {
          calls.push(params);
          return { data: [] };
        },
        createUser: async (params) => {
          calls.push(params);
          return { id: "user_123" };
        },
        updateUser: async () => {
          throw new Error("existing user should not be updated");
        },
      },
      signInTokens: {
        createSignInToken: async (params) => {
          calls.push(params);
          return {
            id: "sit_123",
            url: "https://accounts.barmatrix.app/sign-in/token/abc",
          };
        },
      },
    };

    const result = await createCheckoutAccessLink(
      {
        to: " Student@Example.com ",
        firstName: " Student ",
        lastName: " Example ",
        checkoutSessionId: "cs_test_123",
        purchaseId: "purchase_123",
        studentId: "student_123",
      },
      {
        env: configuredEnv(),
        createClient: () => client,
      },
    );

    assert.deepEqual(result, {
      status: "sent",
      userId: "user_123",
      accessUrl: "https://accounts.barmatrix.app/sign-in/token/abc",
    });
    assert.deepEqual(calls, [
      {
        emailAddress: ["student@example.com"],
        limit: 1,
      },
      {
        emailAddress: ["student@example.com"],
        firstName: "Student",
        lastName: "Example",
        skipPasswordRequirement: true,
        publicMetadata: {
          source: "stripe_checkout",
          checkoutSessionId: "cs_test_123",
          purchaseId: "purchase_123",
          studentId: "student_123",
        },
      },
      {
        userId: "user_123",
        expiresInSeconds: 60 * 60 * 24 * 30,
      },
    ]);
  });

  it("reuses an existing Clerk user and sends a sign-in token", async () => {
    const calls: unknown[] = [];

    const result = await createCheckoutAccessLink(
      {
        to: "student@example.com",
        firstName: "Student",
        lastName: "Example",
        checkoutSessionId: "cs_test_123",
      },
      {
        env: configuredEnv(),
        createClient: () => ({
          users: {
            getUserList: async (params) => {
              calls.push(params);
              return { data: [{ id: "user_existing" }] };
            },
            createUser: async () => {
              throw new Error("existing user should be reused");
            },
            updateUser: async (userId, params) => {
              calls.push({ userId, params });
              return { id: userId };
            },
          },
          signInTokens: {
            createSignInToken: async (params) => {
              calls.push(params);
              return {
                id: "sit_existing",
                url: "https://accounts.barmatrix.app/sign-in/token/existing",
              };
            },
          },
        }),
      },
    );

    assert.deepEqual(result, {
      status: "sent",
      userId: "user_existing",
      accessUrl: "https://accounts.barmatrix.app/sign-in/token/existing",
    });
    assert.deepEqual(calls, [
      { emailAddress: ["student@example.com"], limit: 1 },
      {
        userId: "user_existing",
        params: { firstName: "Student", lastName: "Example" },
      },
      { userId: "user_existing", expiresInSeconds: 60 * 60 * 24 * 30 },
    ]);
  });

  it("returns failed when Clerk rejects account provisioning", async () => {
    const result = await createCheckoutAccessLink(
      {
        to: "student@example.com",
        checkoutSessionId: "cs_test_123",
      },
      {
        env: configuredEnv(),
        createClient: () => ({
          users: {
            getUserList: async () => ({ data: [] }),
            createUser: async () => {
              throw new Error("rate limited");
            },
            updateUser: async () => ({ id: "user_unused" }),
          },
          signInTokens: {
            createSignInToken: async () => {
              throw new Error("should not create token");
            },
          },
        }),
      },
    );

    assert.deepEqual(result, { status: "failed", reason: "clerk_error" });
  });
});
