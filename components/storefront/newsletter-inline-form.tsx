"use client";

import { useState, useTransition, type FormEvent, type ReactNode, type CSSProperties } from "react";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

/**
 * Drop-in replacement for the static "email input + Subscribe button" markup
 * used in template footers/sections. Preserves the caller's className/markup
 * shape via render props so each template keeps its own styling, but wires
 * the form up to the real subscribeToNewsletter server action.
 */
export function NewsletterInlineForm({
  slug,
  className,
  inputPlaceholder = "Your email address",
  children,
  statusClassName,
  buttonStyle,
}: {
  slug: string;
  className?: string;
  inputPlaceholder?: string;
  /** Render prop for the button/icon content, e.g. <>Subscribe <ArrowRight/></> */
  children: ReactNode;
  statusClassName?: string;
  buttonStyle?: CSSProperties;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await subscribeToNewsletter(slug, formData);
      if (result.success) {
        setEmail("");
        setStatus("Subscribed! Thank you.");
      } else {
        setStatus(result.error ?? "Could not subscribe. Please try again.");
      }
    });
  }

  return (
    <>
      <form className={className} onSubmit={submit}>
        <input
          name="email"
          type="email"
          required
          placeholder={inputPlaceholder}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Subscribing…" : children}
        </button>
      </form>
      {status && (
        <p className={statusClassName} role="status" style={statusClassName ? undefined : { margin: "8px 0 0", fontSize: 12, opacity: 0.85 }}>
          {status}
        </p>
      )}
    </>
  );
}
