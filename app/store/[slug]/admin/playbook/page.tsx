// Route: /store/[slug]/admin/playbook
import { redirect } from "next/navigation";
import { assertStoreOwnerAccess } from "@/lib/access/assert-store-access";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { playbookKeyFor } from "@/lib/playbook-meta";
import { getPlaybook } from "@/lib/playbooks";
import { PlaybookReader } from "@/components/dashboard/playbook-reader";

export const metadata = { title: "Playbook" };

export default async function PlaybookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Layout redirects don't reliably re-run on in-app navigation, so the page checks for itself.
  const access = await assertStoreOwnerAccess(slug);
  if (!access.success) redirect(`/store/${slug}/admin`);
  const { store } = access;

  const type = getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const playbook = getPlaybook(playbookKeyFor(type));
  const catalogPath = store.business.sellsProducts || !store.business.offersServices ? "/products" : "/services";

  return <PlaybookReader playbook={playbook} slug={slug} storeUrl={`https://biznest.space/${slug}`} catalogPath={catalogPath} />;
}
