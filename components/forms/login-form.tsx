"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PasswordInput } from "@/components/forms/password-input";
import Link from "next/link";

export function LoginForm({
  isStoreContext = false,
  storeSlug,
}: {
  // Store-branded logins (a customer arriving via a store's link) are
  // shopper sign-ins, not staff/admin ones — "Position@store" is a
  // staff-only convention and is meaningless (and confusing) to a
  // customer, so it's only shown on the generic BizNest login.
  isStoreContext?: boolean;
  storeSlug?: string;
} = {}) {
  const searchParams = useSearchParams();
  const explicitCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl = explicitCallbackUrl ?? "/onboarding/business-verification";
  const prefillEmail = searchParams.get("email") ?? undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail },
  });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", { ...values, redirect: false });

      // NextAuth v5 (beta) has changed which field carries a custom
      // CredentialsSignin `code` across versions — some betas put it on
      // `result.code`, others only ever exposed `result.error` (either as
      // the literal thrown value, or collapsed to the generic
      // "CredentialsSignin" type). Checking both means this keeps working
      // regardless of which behavior the installed beta actually has,
      // instead of silently falling back to the generic message for every
      // failure mode (locked/banned/DB-down) the way it did before these
      // error subclasses existed in lib/auth.ts.
      const errorCode = (result as { code?: string })?.code ?? result?.error;
      if (errorCode) {
        const messages: Record<string, string> = {
          EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
          ACCOUNT_LOCKED: "Too many failed attempts. Try again in 15 minutes.",
          ACCOUNT_BANNED: "This account has been suspended. Contact support.",
          DB_UNAVAILABLE: "Couldn't reach the database. Check DATABASE_URL in Vercel's project settings.",
        };
        toast.error(messages[errorCode] ?? "Invalid email or password.");
        return;
      }
      // Staff who sign in with "Position@store" have no business of their
      // own to onboard — the default callbackUrl above
      // (/onboarding/business-verification) is only correct for an owner
      // registering a store, and was sending staff there too whenever they
      // landed on /login without an explicit callbackUrl (e.g. typing the
      // URL directly rather than being bounced off a protected page).
      // Route them straight to their store's dashboard instead. A caller
      // that *did* pass an explicit callbackUrl (e.g. middleware bouncing
      // an unauthenticated visit to a specific admin page) is left alone,
      // since that destination is already correct.
      let target = callbackUrl;
      if (!explicitCallbackUrl) {
        const session = await getSession();
        if (session?.user?.storeSlug) {
          target = `/${session.user.storeSlug}/admin`;
        }
      }

      // A plain browser navigation, not router.push(): target can point
      // anywhere on the site. Next's client-side router only navigates
      // within pages it knows about, so a full navigation is more reliable
      // here regardless of destination.
      window.location.href = target;
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
          <label className="mb-1 block text-sm font-medium">
            {isStoreContext ? "Email" : "Email, or Position@store"}
          </label>
          <input
            type="text"
            placeholder={isStoreContext ? "you@example.com" : "you@example.com or amaka@yourstorename"}
            autoCapitalize="none"
            className="w-full rounded-md border px-3 py-2 text-sm"
            {...register("email")}
          />
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

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={storeSlug ? `/register?store=${encodeURIComponent(storeSlug)}` : "/register"}
          className="font-medium text-foreground hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
