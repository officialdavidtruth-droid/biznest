import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Sign in to BizNest</h1>
      <p className="mb-6 text-sm text-muted-foreground">Welcome back.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
