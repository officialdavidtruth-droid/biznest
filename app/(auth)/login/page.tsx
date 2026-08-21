import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/forms/login-form";
import { getStoreBranding } from "@/lib/actions/store-branding";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeSlug } = await searchParams;
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
        {store ? `Sign in to ${store.name}` : "Sign in to BizNest"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {store ? `Sign in with your ${store.name} account.` : "Welcome back."}
      </p>
      <Suspense fallback={null}>
        <LoginForm isStoreContext={Boolean(store)} storeSlug={storeSlug} />
      </Suspense>
    </div>
  );
}
