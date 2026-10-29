import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/forms/register-form";
import { redirect } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";
import { previewReferralCode } from "@/lib/referrals/attach";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string; store?: string; ref?: string }>;
}) {
  const { email, callbackUrl, store: storeSlug, ref: referralCode } = await searchParams;
  const store = await getStoreBranding(storeSlug);

  // An existing customer who clicks a friend's link can't use the signup form:
  // send them to their account's referral page with the code pre-filled.
  if (store && storeSlug && referralCode) {
    const session = await getStoreCustomerSessionForStore(storeSlug).catch(() => null);
    if (session?.user) redirect(`/store/${storeSlug}/account/referrals?ref=${encodeURIComponent(referralCode.slice(0, 32))}`);
  }

  let referralBanner: string | null = null;
  if (store && storeSlug && referralCode) {
    const row = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    const preview = row ? await previewReferralCode(row.id, referralCode) : { status: "invalid" as const };
    referralBanner =
      preview.status === "valid"
        ? preview.refereePoints > 0
          ? `You were referred by a friend — you'll get ${preview.refereePoints} points after your first order is completed.`
          : "You were referred by a friend."
        : preview.status === "paused"
          ? `${store.name} isn't running a referral program right now, so this code won't earn rewards.`
          : "This referral code isn't valid, so it won't earn rewards.";
  }

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
      {referralBanner && <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm">{referralBanner}</p>}
      <RegisterForm defaultEmail={email} callbackUrl={callbackUrl} storeSlug={storeSlug} referralCode={referralCode} />
    </AuthShell>
  );
}
