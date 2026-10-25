"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/lib/actions/auth";

const COOLDOWN_SECONDS = 60;

/**
 * "Didn't get the email?" control. Always shows the same confirmation
 * whether or not the address has an account (see resendVerificationEmail),
 * with a 60s cooldown so it can't be hammered.
 */
export function ResendVerification({
  defaultEmail,
  storeSlug,
  heading = "Didn't get your verification email?",
}: {
  defaultEmail?: string;
  storeSlug?: string;
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email.trim()) return toast.error("Enter your email address first.");
    setSending(true);
    try {
      const result = await resendVerificationEmail({ email: email.trim(), storeSlug });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSent(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      toast.error("Couldn't reach the server. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-center text-sm text-muted-foreground hover:underline">
        {heading}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-left">
      <p className="text-sm font-medium text-[var(--bn-ink)]">{heading}</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoCapitalize="none"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0}
        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {sending ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : sent ? "Send again" : "Send verification link"}
      </button>
      {sent && (
        <p className="text-xs text-muted-foreground">
          If that address has an unverified account, a new link is on its way (check spam too). The link works for 24 hours, and only the newest one is valid.
        </p>
      )}
    </div>
  );
}
