"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/actions/auth";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export function ForgotPasswordForm() {
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
      const result = await requestPasswordReset(values);
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
      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 p-4 text-sm">
          If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
        </p>
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          autoFocus
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
