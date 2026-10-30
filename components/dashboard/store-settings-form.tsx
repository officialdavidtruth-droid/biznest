"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/types/actions";

/**
 * Wraps the Settings fields in a <form> that reports the server's answer.
 * The save action validates everything and returns a message instead of silently
 * doing nothing, so the owner always sees whether their changes were kept.
 * The fields themselves stay server-rendered (passed in as children).
 */
export function StoreSettingsForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.success) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        setError(null);
        toast.success("Settings saved.");
        router.refresh();
      } catch {
        const message = "Couldn't save your settings. Check your connection and try again.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-busy={pending}>
      {children}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
