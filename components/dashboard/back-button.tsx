"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.assign(fallbackHref);
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted"
      aria-label="Go back to the previous page"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}
