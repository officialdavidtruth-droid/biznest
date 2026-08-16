"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/lib/actions/auth";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PasswordInput } from "@/components/forms/password-input";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setIsSubmitting(true);
    try {
      const result = await resetPassword(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Password updated. Sign in with your new password.");
      router.push("/login");
    } catch {
      toast.error("Couldn't reach the server. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 p-4 text-sm">
          This reset link is missing its token. Request a new one from the sign-in page.
        </p>
        <Link href="/forgot-password" className="block text-center text-sm text-muted-foreground hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("token")} />
      <div>
        <label className="mb-1 block text-sm font-medium">New password</label>
        <PasswordInput {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm new password</label>
        <PasswordInput {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
