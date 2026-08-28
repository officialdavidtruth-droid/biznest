import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { getUnreadStoreMessageCount } from "@/lib/actions/account";
import { redirect, notFound } from "next/navigation";
import { SignatureCustomerShell } from "@/components/storefront/signature-customer-shell";
import { prisma } from "@/lib/prisma";
import { isSignatureTemplate, getSignatureTheme } from "@/lib/template-themes";
import { StoreAccountLegacyShell } from "@/components/storefront/store-account-legacy-shell";

export default async function StoreAccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = await requireStoreCustomer(slug);
  if (!membership) redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/store/${encodeURIComponent(slug)}/account`);
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const unreadMessageCount = await getUnreadStoreMessageCount(slug);
  const record = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  const templateName = record?.template?.name ?? "";

  // Which nav links are even meaningful for this store depends on what it
  // actually sells -- a pure service business has no "Orders"/"Addresses"
  // (nothing physical ships to anyone), and a pure product business has no
  // "Bookings" (nothing is scheduled). Hybrid stores (e.g. a hotel with a
  // restaurant that also sells retail items) get both. Sourced from the
  // same sellsProducts/offersServices flags the admin dashboard's
  // capability system (lib/capabilities.ts) already uses, so the customer
  // account nav can't drift out of sync with what the business actually is.
  const nav = { sellsProducts: store.sellsProducts, offersServices: store.offersServices };

  if (isSignatureTemplate(templateName)) {
    const theme = getSignatureTheme(templateName);
    return <SignatureCustomerShell slug={slug} templateName={templateName} storeName={store.name} logoUrl={store.logoUrl} email={membership.user.email} unreadMessageCount={unreadMessageCount} nav={nav}>
      <div style={{ ["--sig-headline" as string]: theme.headlineFont, ["--sig-font" as string]: theme.font }}>{children}</div>
    </SignatureCustomerShell>;
  }

  return <StoreAccountLegacyShell slug={slug} store={store} membership={membership} unreadMessageCount={unreadMessageCount} nav={nav}>{children}</StoreAccountLegacyShell>;
}
