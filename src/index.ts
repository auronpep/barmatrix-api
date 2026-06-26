// Hostinger hPanel starts dist/index.js directly, so this file is the preload.
import "./sentry-init.js";
await import("./app-entry.js");
