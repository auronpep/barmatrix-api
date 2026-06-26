// Hostinger hPanel starts dist/index.js directly, so this file is the preload.
import "./sentry-init.js";
void import("./app-entry.js").catch((err) => {
  console.error("[startup] app import failed:", err);
  process.exitCode = 1;
});
