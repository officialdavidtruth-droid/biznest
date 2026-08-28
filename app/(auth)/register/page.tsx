import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      eyebrow={store ? "Create your account" : "Get started"}
      title={store ? `Create your account to shop ${store.name}` : "Create your BizNest account"}
      subtitle={
        store
          ? `This account is just for ${store.name} — it won't work on other BizNest stores.`
          : "Start selling products, offering services, or shopping across BizNest stores."
      }
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
      <RegisterForm defaultEmail={email} callbackUrl={callbackUrl} storeSlug={storeSlug} />
    </AuthShell>
  );
}
