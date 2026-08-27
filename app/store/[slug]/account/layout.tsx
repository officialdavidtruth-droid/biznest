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

  if (isSignatureTemplate(templateName)) {
    const theme = getSignatureTheme(templateName);
    return <SignatureCustomerShell slug={slug} templateName={templateName} storeName={store.name} logoUrl={store.logoUrl} email={membership.user.email} unreadMessageCount={unreadMessageCount}>
      <div style={{ ["--sig-headline" as string]: theme.headlineFont, ["--sig-font" as string]: theme.font }}>{children}</div>
    </SignatureCustomerShell>;
  }

  return <StoreAccountLegacyShell slug={slug} store={store} membership={membership} unreadMessageCount={unreadMessageCount}>{children}</StoreAccountLegacyShell>;
}
