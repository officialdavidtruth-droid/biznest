"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/onboarding/business-verification";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    const result = await signIn("credentials", { ...values, redirect: false });
    setIsSubmitting(false);

    if (result?.error) {
      const messages: Record<string, string> = {
        EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
        ACCOUNT_LOCKED: "Too many failed attempts. Try again in 15 minutes.",
        ACCOUNT_BANNED: "This account has been suspended. Contact support.",
      };
      toast.error(messages[result.error] ?? "Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
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
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input type="password" className="w-full rounded-md border px-3 py-2 text-sm" {...register("password")} />
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
    </div>
  );
}
