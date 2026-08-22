import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a link to reset your password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
