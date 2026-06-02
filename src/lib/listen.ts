// Server startup error handling.
//
// `app.listen()` returns a net server that emits an 'error' event when the
// socket fails to bind. Without an 'error' listener, Node re-throws that event
// as an uncaught exception — which Sentry's onuncaughtexception integration
// reports as a *fatal* issue. A port collision (EADDRINUSE) is an expected
// operational condition, not a code bug, so we handle it explicitly: print an
// actionable message and exit cleanly, keeping it out of Sentry's fatal path.

export interface ListenErrorDeps {
  logger?: Pick<Console, "error">;
  exit?: (code: number) => void;
}

export function handleListenError(
  err: NodeJS.ErrnoException,
  port: number,
  deps: ListenErrorDeps = {},
): void {
  const logger = deps.logger ?? console;
  const exit = deps.exit ?? process.exit;

  if (err.code === "EADDRINUSE") {
    logger.error(
      `[startup] port ${port} is already in use — another barmatrix-api ` +
        `instance is probably already running. Stop it, or set PORT to a free port.`,
    );
  } else {
    logger.error(`[startup] failed to bind port ${port}:`, err);
  }

  exit(1);
}
