"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { PasswordInput } from "@/components/forms/password-input";
import Link from "next/link";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/onboarding/business-verification";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", { ...values, turnstileToken, redirect: false });

      // NextAuth v5 (beta) has changed which field carries a custom
      // CredentialsSignin `code` across versions — some betas put it on
      // `result.code`, others only ever exposed `result.error` (either as
      // the literal thrown value, or collapsed to the generic
      // "CredentialsSignin" type). Checking both means this keeps working
      // regardless of which behavior the installed beta actually has,
      // instead of silently falling back to the generic message for every
      // failure mode (locked/banned/DB-down/bot-check) the way it did
      // before these error subclasses existed in lib/auth.ts.
      const errorCode = (result as { code?: string })?.code ?? result?.error;
      if (errorCode) {
        const messages: Record<string, string> = {
          EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
          ACCOUNT_LOCKED: "Too many failed attempts. Try again in 15 minutes.",
          ACCOUNT_BANNED: "This account has been suspended. Contact support.",
          DB_UNAVAILABLE: "Couldn't reach the database. Check DATABASE_URL in Vercel's project settings.",
          BOT_CHECK_FAILED: "Verification failed. Please retry the challenge below and try again.",
        };
        toast.error(messages[errorCode] ?? "Invalid email or password.");
        return;
      }
      // A plain browser navigation, not router.push(): callbackUrl can point
      // anywhere on the site. Next's client-side router only navigates
      // within pages it knows about, so a full navigation is more reliable
      // here regardless of destination.
      window.location.href = callbackUrl;
    } catch {
      // A thrown error here (vs. a normal {error} result) means the
      // sign-in request itself failed at the network/host level — this is
      // exactly what previously left the button stuck on "Signing in…"
      // forever with no feedback. Surface it instead of hanging silently.
      toast.error("Couldn't reach the server. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input type="email" className="w-full rounded-md border px-3 py-2 text-sm" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <TurnstileWidget onVerify={setTurnstileToken} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">or</span>
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl })}
        className="w-full rounded-md border py-2 text-sm font-medium"
      >
        Continue with Google
      </button>
    </div>
  );
}
