import { createClerkClient } from "@clerk/express";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

const ACCESS_LINK_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface ClerkAccessConfig {
  secretKey: string;
  frontendUrl: string;
}

export interface CheckoutAccessLinkInput {
  to: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  fullName?: string | null | undefined;
  checkoutSessionId: string;
  purchaseId?: string | null;
  studentId?: string | null;
}

export interface ClerkAccessClient {
  users: {
    getUserList(params: {
      emailAddress: string[];
      limit: number;
    }): Promise<{ data: Array<{ id: string }> }>;
    createUser(params: {
      emailAddress: string[];
      firstName?: string;
      lastName?: string;
      skipPasswordRequirement: boolean;
      publicMetadata: Record<string, string>;
    }): Promise<{ id: string }>;
    updateUser(
      userId: string,
      params: { firstName?: string; lastName?: string },
    ): Promise<{ id: string }>;
  };
  signInTokens: {
    createSignInToken(params: {
      userId: string;
      expiresInSeconds: number;
    }): Promise<{ id?: string; url?: string | null }>;
  };
}

export type ClerkAccessLinkResult =
  | { status: "sent"; userId: string; accessUrl: string | null }
  | { status: "skipped"; reason: "missing_config" | "missing_recipient" }
  | { status: "failed"; reason: "clerk_error" };

interface CreateCheckoutAccessLinkOptions {
  env?: Env;
  createClient?: (secretKey: string) => ClerkAccessClient;
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

export async function createCheckoutAccessLink(
  input: CheckoutAccessLinkInput,
  options: CreateCheckoutAccessLinkOptions = {},
): Promise<ClerkAccessLinkResult> {
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
    (createClerkClient({ secretKey: config.secretKey }) as ClerkAccessClient);

  try {
    const existing = await client.users.getUserList({
      emailAddress: [recipient],
      limit: 1,
    });
    const names = resolveNameParts(input);
    const user =
      existing.data[0] ??
      (await client.users.createUser({
        emailAddress: [recipient],
        ...names,
        skipPasswordRequirement: true,
        publicMetadata: compactMetadata({
          source: "stripe_checkout",
          checkoutSessionId: input.checkoutSessionId,
          purchaseId: input.purchaseId,
          studentId: input.studentId,
        }),
      }));

    if (existing.data[0] && Object.keys(names).length > 0) {
      await client.users.updateUser(user.id, names);
    }

    const token = await client.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: ACCESS_LINK_TTL_SECONDS,
    });

    return {
      status: "sent",
      userId: user.id,
      accessUrl: clean(token.url),
    };
  } catch {
    return { status: "failed", reason: "clerk_error" };
  }
}

// Backward-compatible alias for callers/tests from the invitation pass.
export const createCheckoutAccessInvitation = createCheckoutAccessLink;

function resolveNameParts(input: CheckoutAccessLinkInput): {
  firstName?: string;
  lastName?: string;
} {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  if (firstName || lastName) {
    return {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    };
  }

  const fullName = clean(input.fullName);
  if (!fullName) {
    return {};
  }

  const parts = fullName.split(/\s+/);
  const first = parts.shift();
  const last = parts.join(" ");
  return {
    ...(first ? { firstName: first } : {}),
    ...(last ? { lastName: last } : {}),
  };
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
