import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-options";

/**
 * Next.js loads this once per server instance. Initialises Sentry for the
 * Node and Edge (middleware) runtimes. No-op unless SENTRY_DSN is set.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions(0.05));
  }
}

// Reports uncaught errors from server components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError;
