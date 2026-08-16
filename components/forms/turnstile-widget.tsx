"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
    __turnstileOnLoad?: () => void;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__turnstileOnLoad&render=explicit";

/**
 * Renders a Cloudflare Turnstile challenge and reports the resulting token
 * to the parent form via onVerify. Silently no-ops (and never blocks
 * submission) if NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so local dev
 * without a Cloudflare account isn't broken — the server-side check in
 * lib/turnstile.ts still fails closed in production if the secret is
 * missing, so this can't be used to bypass protection on a real deploy.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const domId = useId();

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    function render() {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        callback: onVerify,
        "expired-callback": () => onVerify(""),
        "error-callback": () => onVerify(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      window.__turnstileOnLoad = render;
      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
    }
  }, [siteKey, onVerify]);

  if (!siteKey) return null;

  return <div ref={containerRef} id={`turnstile-${domId}`} className="my-2" />;
}
