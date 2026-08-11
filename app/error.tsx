"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
        style={{ background: "var(--bn-ink-raised)", color: "var(--bn-marigold)" }}
      >
        !
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "hsl(var(--foreground))" }}>
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        This page hit an unexpected error. It's been logged — try again, or head back home.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--bn-jade)" }}
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--bn-ink-line)", color: "hsl(var(--foreground))" }}
        >
          Go home
        </a>
      </div>
      {error.digest && (
        <p className="mt-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
