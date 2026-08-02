import { RegisterForm } from "@/components/forms/register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Create your BizNest account</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Start selling products, offering services, or shopping across BizNest stores.
      </p>
      <RegisterForm />
    </div>
  );
}
