"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

// Loaded inside the desktop app with the code from the browser and the verifier only the app knows.
function Finish() {
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const code = params.get("code") ?? "";
    const verifier = params.get("verifier") ?? "";
    (async () => {
      const res = await signIn("desktop", { code, verifier, redirect: false });
      if (res?.error || !res?.ok) return setFailed(true);
      window.location.replace("/");
    })().catch(() => setFailed(true));
  }, [params]);
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      {failed ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">That sign-in link expired. Please try again.</p>
          <a href="/login" className="inline-block rounded-full bg-[#0f6410] px-5 py-2.5 text-sm font-semibold text-white">Back to sign in</a>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Signing you in…</p>
      )}
    </main>
  );
}

export default function DesktopAuthFinish() {
  return <Suspense fallback={null}><Finish /></Suspense>;
}
