import { createClerkClient } from "@clerk/express";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface ClerkAccessConfig {
  secretKey: string;
  frontendUrl: string;
}

export interface CheckoutAccessInvitationInput {
  to: string | null | undefined;
  fullName?: string | null | undefined;
  checkoutSessionId: string;
  purchaseId?: string | null;
  studentId?: string | null;
}

export interface ClerkInvitationClient {
  invitations: {
    createInvitation(params: {
      emailAddress: string;
      redirectUrl: string;
      notify: boolean;
      ignoreExisting: boolean;
      publicMetadata: Record<string, string>;
    }): Promise<{ id?: string; url?: string | null }>;
  };
}

export type ClerkAccessInvitationResult =
  | { status: "sent"; invitationId: string | null; invitationUrl: string | null }
  | { status: "skipped"; reason: "missing_config" | "missing_recipient" }
  | { status: "failed"; reason: "clerk_error" };

interface CreateCheckoutAccessInvitationOptions {
  env?: Env;
  createClient?: (secretKey: string) => ClerkInvitationClient;
}

export function resolveClerkAccessConfig(
  env: Env = process.env,
): ClerkAccessConfig | null {
  const secretKey = clean(env.CLERK_SECRET_KEY);
  if (!secretKey) {
    return null;
  }

  return {
    secretKey,
    frontendUrl: stripTrailingSlash(clean(env.FRONTEND_URL) ?? "https://barmatrix.app"),
  };
}

export async function createCheckoutAccessInvitation(
  input: CheckoutAccessInvitationInput,
  options: CreateCheckoutAccessInvitationOptions = {},
): Promise<ClerkAccessInvitationResult> {
  const config = resolveClerkAccessConfig(options.env);
  if (!config) {
    return { status: "skipped", reason: "missing_config" };
  }

  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    return { status: "skipped", reason: "missing_recipient" };
  }

  const client =
    options.createClient?.(config.secretKey) ??
    (createClerkClient({ secretKey: config.secretKey }) as ClerkInvitationClient);

  try {
    const invitation = await client.invitations.createInvitation({
      emailAddress: recipient,
      redirectUrl: `${config.frontendUrl}/sign-up?after=dashboard&source=clerk_invitation`,
      notify: true,
      ignoreExisting: true,
      publicMetadata: compactMetadata({
        source: "stripe_checkout",
        checkoutSessionId: input.checkoutSessionId,
        purchaseId: input.purchaseId,
        studentId: input.studentId,
      }),
    });

    return {
      status: "sent",
      invitationId: invitation.id ?? null,
      invitationUrl: clean(invitation.url),
    };
  } catch {
    return { status: "failed", reason: "clerk_error" };
  }
}

function compactMetadata(
  metadata: Record<string, string | null | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
