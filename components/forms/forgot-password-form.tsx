"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/actions/auth";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, MailCheck } from "lucide-react";
import { AuthInput } from "@/components/forms/auth-input";
import { AuthSubmitButton } from "@/components/forms/auth-buttons";

export function ForgotPasswordForm({ storeSlug }: { storeSlug?: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset({ ...values, storeSlug });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // Same message regardless of whether the email exists — see the
      // comment on requestPasswordReset for why.
      setSubmitted(true);
    } catch {
      toast.error("Couldn't reach the server. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--bn-marigold)" }} />
          <p className="text-sm text-[var(--bn-ink)]">
            If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
          </p>
        </div>
        <Link href={storeSlug ? `/login?store=${encodeURIComponent(storeSlug)}` : "/login"} className="block text-center text-sm text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--bn-ink)]">Email</label>
        <AuthInput icon={Mail} type="email" autoFocus placeholder="you@example.com" {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <AuthSubmitButton disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </AuthSubmitButton>
      <Link href={storeSlug ? `/login?store=${encodeURIComponent(storeSlug)}` : "/login"} className="block text-center text-sm text-muted-foreground hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
