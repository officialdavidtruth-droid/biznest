import Image from "next/image";
import { RegisterForm } from "@/components/forms/register-form";
import { getStoreBranding } from "@/lib/actions/store-branding";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string; store?: string }>;
}) {
  const { email, callbackUrl, store: storeSlug } = await searchParams;
  const store = await getStoreBranding(storeSlug);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      {store?.logoUrl && (
        <Image
          src={store.logoUrl}
          alt={store.name}
          width={40}
          height={40}
          className="mb-3 h-10 w-10 rounded-md object-cover"
        />
      )}
      <h1 className="mb-1 text-2xl font-semibold">
        {store ? `Create your account to shop ${store.name}` : "Create your BizNest account"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {store
          ? `Sign up on ${store.name}`
          : "Start selling products, offering services, or shopping across BizNest stores."}
      </p>
      <RegisterForm defaultEmail={email} callbackUrl={callbackUrl} storeSlug={storeSlug} />
    </div>
  );
}
