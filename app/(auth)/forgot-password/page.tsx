import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter the email on your account and we&apos;ll send you a link to reset your password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
