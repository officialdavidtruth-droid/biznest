"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerUser } from "@/lib/actions/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/forms/turnstile-widget";

export function RegisterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setIsSubmitting(true);
    const result = await registerUser(values, turnstileToken);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Account created. Check your email to verify your address.");
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="name">
          Full name
        </label>
        <input id="name" className="w-full rounded-md border px-3 py-2 text-sm" {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("password")}
        />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <TurnstileWidget onVerify={setTurnstileToken} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
