"use client";

import { useEffect } from "react";

export function ReturnToApp({ url }: { url: string }) {
  useEffect(() => { window.location.href = url; }, [url]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">You&apos;re signed in</h1>
      <p className="max-w-sm text-sm text-gray-600">Go back to the BizNest app. If it did not open by itself, press the button.</p>
      <a href={url} className="rounded-full bg-[#0f6410] px-6 py-3 text-sm font-semibold text-white">Open BizNest</a>
    </main>
  );
}
