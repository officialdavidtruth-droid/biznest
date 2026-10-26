/**
 * Shared Sentry init options for the server, edge and browser runtimes.
 *
 * Sentry is a complete no-op until a DSN is set, so local dev, preview builds
 * and anyone cloning the repo are never affected.
 *
 *   SENTRY_DSN               server + edge
 *   NEXT_PUBLIC_SENTRY_DSN   browser (same value as SENTRY_DSN)
 */
import type { ErrorEvent } from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Errors that are normal control flow or pure noise, not bugs.
const IGNORED_ERRORS = [
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "CredentialsSignin", // wrong password is not an incident
  "AbortError",
  "ResizeObserver loop",
  "Non-Error promise rejection captured",
];

/** Strips anything that could carry PII or credentials before an event leaves the server/browser. */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|set-cookie|x-forwarded-for|x-real-ip|verif-hash|x-paystack-signature)$/i.test(h)) {
          delete event.request.headers[h];
        }
      }
    }
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  return event;
}

export function sentryOptions(tracesSampleRate: number) {
  return {
    dsn,
    enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "production",
    tracesSampleRate,
    sendDefaultPii: false,
    ignoreErrors: IGNORED_ERRORS,
    beforeSend: scrubEvent,
  };
}
