"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary: catches errors thrown in the root layout itself,
 * where app/error.tsx can't help. Must render its own <html>/<body>.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          We&apos;ve been notified. Please refresh the page or try again in a moment.
        </p>
        <a href="/" style={{ display: "inline-block", marginTop: "1rem", color: "#0a7d4f" }}>
          Go home
        </a>
      </body>
    </html>
  );
}
