import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      eyebrow={store ? "Welcome back" : "Sign in"}
      title={store ? `Sign in to ${store.name}` : "Sign in to BizNest"}
      subtitle={store ? `Use the account you created for ${store.name}.` : "Welcome back — let's get you in."}
      storeName={store?.name}
      storeLogoUrl={store?.logoUrl}
      accent={store?.themeColors?.primary}
      businessType={store?.businessType}
      heroSubtitle={store?.heroSubtitle}
      businessCategory={store?.businessCategory}
      businessDescription={store?.businessDescription}
      sellsProducts={store?.sellsProducts}
      offersServices={store?.offersServices}
    >
      <Suspense fallback={null}>
        <LoginForm isStoreContext={Boolean(store)} storeSlug={storeSlug} />
      </Suspense>
    </AuthShell>
  );
}
