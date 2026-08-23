import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { getStoreBranding } from "@/lib/actions/store-branding";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const { store: storeSlug } = await searchParams;
  const store = await getStoreBranding(storeSlug);
  return <AuthShell eyebrow="Account recovery" title={store ? `Reset your ${store.name} password` : "Reset your password"} subtitle={store ? `Recover the customer account you use with ${store.name}.` : "Enter the email on your account and we'll send you a link to reset your password."} storeName={store?.name} storeLogoUrl={store?.logoUrl} accent={store?.themeColors?.primary}>
    <ForgotPasswordForm storeSlug={storeSlug} />
  </AuthShell>;
}
