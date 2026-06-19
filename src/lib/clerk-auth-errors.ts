const CLERK_AUTH_FAILURE_REASONS = new Set([
  "token-expired",
  "token-iat-in-the-future",
  "token-invalid",
  "token-invalid-algorithm",
  "token-invalid-authorized-parties",
  "token-invalid-signature",
  "token-not-active-yet",
]);

function readStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function isClerkJwtParserFailure(err: unknown): boolean {
  const isSyntaxError =
    err instanceof SyntaxError || readStringProperty(err, "name") === "SyntaxError";
  if (!isSyntaxError) {
    return false;
  }

  const stack = readStringProperty(err, "stack") ?? "";
  return (
    stack.includes("@clerk/backend") &&
    /\b(?:decodeJwt|verifyToken|authenticateRequest|authenticateAnyRequestWithTokenInHeader)\b/.test(
      stack,
    )
  );
}

export function isClerkAuthFailure(err: unknown): boolean {
  const reason = readStringProperty(err, "reason") ?? readStringProperty(err, "code");
  if (reason && CLERK_AUTH_FAILURE_REASONS.has(reason)) {
    return true;
  }

  if (isClerkJwtParserFailure(err)) {
    return true;
  }

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /\breason=(token-(?:expired|iat-in-the-future|invalid(?:-(?:algorithm|authorized-parties|signature))?|not-active-yet))\b/.test(
    message,
  );
}
