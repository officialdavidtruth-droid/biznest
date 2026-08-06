"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Eye, EyeOff, Lock, RefreshCw } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/supaadmin";

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!pin || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      // Full navigation, not router.push — we need the new cookie to be
      // sent on the next request so middleware sees it immediately.
      window.location.href = callbackUrl;
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "hsl(var(--background))" }}>
      <div
        className="w-full max-w-sm space-y-5 rounded-2xl p-8"
        style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "hsl(var(--primary))" }}
          >
            <Shield size={28} style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
            BizNest Platform Admin
          </h1>
          <p className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Enter the admin PIN to continue
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-center text-xs" style={{ background: "hsl(0 84% 65% / 0.12)", color: "hsl(0 84% 70%)" }}>
            {error}
          </div>
        )}

        <div className="relative">
          <input
            type={showPin ? "text" : "password"}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Admin PIN"
            autoFocus
            className="w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none"
            style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
          />
          <button
            type="button"
            onClick={() => setShowPin((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "hsl(var(--muted-foreground))" }}
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
          >
            {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <button
          onClick={submit}
          disabled={!pin || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
          {submitting ? "Verifying…" : "Enter Admin Panel"}
        </button>

        <p className="text-center text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          PIN is set via <code>ADMIN_PIN</code> in your environment variables.
        </p>
      </div>
    </div>
  );
}

export default function SupaAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
