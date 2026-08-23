"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerUser } from "@/lib/actions/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { User, Mail } from "lucide-react";
import { AuthInput } from "@/components/forms/auth-input";
import { PasswordInput } from "@/components/forms/password-input";
import { AuthSubmitButton, GoogleButton, AuthDivider } from "@/components/forms/auth-buttons";
import Link from "next/link";

export function RegisterForm({
  defaultEmail,
  callbackUrl,
  storeSlug,
}: {
  defaultEmail?: string;
  callbackUrl?: string;
  storeSlug?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: defaultEmail },
  });

  async function onSubmit(values: RegisterInput) {
    setIsSubmitting(true);
    const result = await registerUser(values, storeSlug);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Account created. Check your email to verify your address.");
    // Carries a staff-invite link (or any other pending destination) through
    // registration → login, so e.g. someone accepting a staff invite lands
    // back on /staff/accept?token=... automatically instead of having to
    // find the original email again after creating their account.
    const loginParams = new URLSearchParams({ email: values.email });
    if (callbackUrl) loginParams.set("callbackUrl", callbackUrl);
    if (storeSlug) loginParams.set("store", storeSlug);
    router.push(`/login?${loginParams.toString()}`);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--bn-ink)]" htmlFor="name">
            Full name
          </label>
          <AuthInput icon={User} id="name" placeholder="Amaka Chukwu" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--bn-ink)]" htmlFor="email">
            Email
          </label>
          <AuthInput icon={Mail} id="email" type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--bn-ink)]" htmlFor="password">
            Password
          </label>
          <PasswordInput id="password" placeholder="At least 8 characters" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--bn-ink)]" htmlFor="confirmPassword">
            Confirm password
          </label>
          <PasswordInput id="confirmPassword" placeholder="Re-enter your password" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <AuthSubmitButton disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </AuthSubmitButton>
      </form>

      {!storeSlug && <>
        <AuthDivider />
        <GoogleButton onClick={() => signIn("google", { callbackUrl: callbackUrl ?? "/onboarding/business-verification" })} />
      </>}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={storeSlug ? `/login?store=${encodeURIComponent(storeSlug)}` : "/login"}
          className="font-medium text-[var(--bn-ink)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
