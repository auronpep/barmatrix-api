// Preloaded by the production start command so Sentry can patch Express before
// the app entry imports it. Importing config first loads Hostinger's external
// env file without importing application routes.
import "./config.js";
import { initSentry } from "./sentry.js";

initSentry();
