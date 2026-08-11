"use client";

import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
        This store hit a snag
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        We couldn't load part of this storefront. It's been logged — try again in a moment.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--bn-jade)" }}
      >
        Try again
      </button>
    </div>
  );
}
