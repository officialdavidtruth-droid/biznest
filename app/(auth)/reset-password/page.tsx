import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose a new password for your account.</p>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
