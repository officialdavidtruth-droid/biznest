"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, User } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerMember } from "@/lib/actions/member";
import { AuthInput } from "@/components/forms/auth-input";
import { PasswordInput } from "@/components/forms/password-input";
import { AuthSubmitButton } from "@/components/forms/auth-buttons";

/** Plain sign-up for people who want to follow and browse. No store, no dashboard. */
export function JoinForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const next = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/browse";

  async function onSubmit(values: RegisterInput) {
    setBusy(true);
    const r = await registerMember(values);
    setBusy(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Account created. Sign in to start following businesses.");
    router.push(`/login?${new URLSearchParams({ email: values.email, callbackUrl: next }).toString()}`);
  }

  const label = "mb-1.5 block text-sm font-medium text-[var(--bn-ink)]";
  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={label} htmlFor="name">Full name</label>
          <AuthInput icon={User} id="name" placeholder="Amaka Chukwu" autoComplete="name" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <label className={label} htmlFor="email">Email</label>
          <AuthInput icon={Mail} id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <label className={label} htmlFor="password">Password</label>
          <PasswordInput id="password" placeholder="At least 8 characters" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div>
          <label className={label} htmlFor="confirmPassword">Confirm password</label>
          <PasswordInput id="confirmPassword" placeholder="Re-enter your password" {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <AuthSubmitButton disabled={busy}>{busy ? "Creating account…" : "Create account"}</AuthSubmitButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(next)}`} className="font-medium text-[var(--bn-ink)] hover:underline">Sign in</Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        This account is for following and browsing. To sell, <Link href="/register" className="underline">open a business store</Link> instead.
      </p>
    </div>
  );
}
