"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold" style={{ color: "var(--bn-ivory)" }}>
        This page didn't load
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--bn-mute)" }}>
        Something went wrong loading this dashboard page. The rest of your dashboard is fine —
        try reloading this section.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--bn-marigold)" }}
      >
        Reload section
      </button>
    </div>
  );
}
