"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Share button with a desktop fallback.
 *
 * - Uses the native share sheet where it exists (mobile, Safari, Edge).
 * - Dismissing the sheet rejects with AbortError; that is a normal user
 *   action, so it is swallowed instead of surfacing as an unhandled rejection.
 * - Everywhere else (most desktop browsers) the page link is copied to the
 *   clipboard and the button confirms it. If the clipboard is blocked, the
 *   link is shown in a prompt so it can still be copied by hand.
 */
export function ShareButton({ title, className = "hr-share" }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function onShare() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as { name?: string } | null)?.name === "AbortError") return; // user closed the sheet
        // Any other failure: fall through to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button type="button" className={className} onClick={onShare} aria-live="polite">
      {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? "Link copied" : "Share"}
    </button>
  );
}
