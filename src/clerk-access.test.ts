import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCheckoutAccessInvitation,
  resolveClerkAccessConfig,
  type ClerkInvitationClient,
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

    const result = await createCheckoutAccessInvitation(
      {
        to: "student@example.com",
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
    const result = await createCheckoutAccessInvitation(
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

  it("creates and emails a Clerk invitation for the checkout email", async () => {
    const calls: unknown[] = [];
    const client: ClerkInvitationClient = {
      invitations: {
        createInvitation: async (params) => {
          calls.push(params);
          return {
            id: "inv_123",
            url: "https://accounts.barmatrix.app/invitations/accept?token=abc",
          };
        },
      },
    };

    const result = await createCheckoutAccessInvitation(
      {
        to: " Student@Example.com ",
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
      invitationId: "inv_123",
      invitationUrl: "https://accounts.barmatrix.app/invitations/accept?token=abc",
    });
    assert.deepEqual(calls, [
      {
        emailAddress: "student@example.com",
        redirectUrl: "https://barmatrix.app/sign-up?after=dashboard&source=clerk_invitation",
        notify: true,
        ignoreExisting: true,
        publicMetadata: {
          source: "stripe_checkout",
          checkoutSessionId: "cs_test_123",
          purchaseId: "purchase_123",
          studentId: "student_123",
        },
      },
    ]);
  });

  it("returns failed when Clerk rejects the invitation", async () => {
    const result = await createCheckoutAccessInvitation(
      {
        to: "student@example.com",
        checkoutSessionId: "cs_test_123",
      },
      {
        env: configuredEnv(),
        createClient: () => ({
          invitations: {
            createInvitation: async () => {
              throw new Error("rate limited");
            },
          },
        }),
      },
    );

    assert.deepEqual(result, { status: "failed", reason: "clerk_error" });
  });
});
