"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

// Opened in the person's normal browser by the BizNest desktop app. Starts Google sign-in and, when it
// finishes, lands on /desktop-auth/complete which hands the login back to the app.
function Start() {
  const challenge = useSearchParams().get("challenge") ?? "";
  const valid = /^[A-Za-z0-9_-]{43}$/.test(challenge);
  useEffect(() => {
    if (valid) void signIn("google", { callbackUrl: `/desktop-auth/complete?challenge=${challenge}` });
  }, [challenge, valid]);
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-sm text-gray-600">{valid ? "Opening Google sign-in…" : "This sign-in link is not valid. Go back to the BizNest app and try again."}</p>
    </main>
  );
}

export default function DesktopAuthStart() {
  return <Suspense fallback={null}><Start /></Suspense>;
}
