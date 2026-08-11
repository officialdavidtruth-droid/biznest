"use client";

import { useEffect } from "react";

export default function SupaAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Supaadmin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
        Platform admin page failed to load
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        Logged for follow-up. This doesn't affect stores or customers — just this admin view.
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
