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

interface CheckoutInvitationInput {
  secretKey: string;
  emailAddress: string;
  frontendUrl: string;
  publicMetadata: Record<string, string>;
}

interface CheckoutInvitationResult {
  id: string;
  url: string | null;
}

interface CreateCheckoutAccessLinkOptions {
  env?: Env;
  createClient?: (secretKey: string) => ClerkAccessClient;
  createInvitation?: (
    input: CheckoutInvitationInput,
  ) => Promise<CheckoutInvitationResult>;
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
    const existingUser = existing.data[0];
    const user = existingUser
      ? { kind: "user" as const, id: existingUser.id }
      : await createUserOrInvite({
          client,
          names,
          input,
          recipient,
          config,
          createInvitation: options.createInvitation,
        });

    if (existingUser && Object.keys(names).length > 0) {
      await client.users.updateUser(user.id, names);
    }

    if (user.kind === "invitation") {
      return {
        status: "sent",
        userId: user.id,
        accessUrl: user.url,
      };
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

async function createUserOrInvite({
  client,
  names,
  input,
  recipient,
  config,
  createInvitation,
}: {
  client: ClerkAccessClient;
  names: { firstName?: string; lastName?: string };
  input: CheckoutAccessLinkInput;
  recipient: string;
  config: ClerkAccessConfig;
  createInvitation?: (
    input: CheckoutInvitationInput,
  ) => Promise<CheckoutInvitationResult>;
}): Promise<
  | { kind: "user"; id: string }
  | { kind: "invitation"; id: string; url: string | null }
> {
  try {
    const user = await client.users.createUser({
      emailAddress: [recipient],
      ...names,
      skipPasswordRequirement: true,
      publicMetadata: checkoutPublicMetadata(input),
    });
    return { kind: "user", id: user.id };
  } catch (err) {
    if (!isPasswordlessCreationDisallowed(err)) {
      throw err;
    }
    const invite = await (createInvitation ?? createCheckoutInvitation)({
      secretKey: config.secretKey,
      emailAddress: recipient,
      frontendUrl: config.frontendUrl,
      publicMetadata: checkoutPublicMetadata(input),
    });
    return { kind: "invitation", id: invite.id, url: invite.url };
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

function checkoutPublicMetadata(
  input: CheckoutAccessLinkInput,
): Record<string, string> {
  return compactMetadata({
    source: "stripe_checkout",
    checkoutSessionId: input.checkoutSessionId,
    purchaseId: input.purchaseId,
    studentId: input.studentId,
  });
}

function isPasswordlessCreationDisallowed(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("skip_password_requirement");
}

async function createCheckoutInvitation(
  input: CheckoutInvitationInput,
): Promise<CheckoutInvitationResult> {
  const response = await fetch("https://api.clerk.com/v1/invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: input.emailAddress,
      redirect_url: `${input.frontendUrl}/sign-up?after=dashboard`,
      public_metadata: input.publicMetadata,
      notify: true,
      ignore_existing: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Clerk invitation failed: ${response.status}`);
  }
  const invitation = (await response.json()) as {
    id?: string | null;
    url?: string | null;
  };
  return {
    id: clean(invitation.id) ?? input.emailAddress,
    url: clean(invitation.url),
  };
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
