import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { getStoreBranding } from "@/lib/actions/store-branding";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; store?: string }> }) {
  const { store: storeSlug } = await searchParams;
  const store = await getStoreBranding(storeSlug);
  return <AuthShell eyebrow="Account recovery" title={store ? `Set a new ${store.name} password` : "Set a new password"} subtitle={store ? `This reset applies to your customer account for ${store.name}.` : "Choose a new password for your account."} storeName={store?.name} storeLogoUrl={store?.logoUrl} accent={store?.themeColors?.primary}>
    <Suspense fallback={null}><ResetPasswordForm /></Suspense>
  </AuthShell>;
}
