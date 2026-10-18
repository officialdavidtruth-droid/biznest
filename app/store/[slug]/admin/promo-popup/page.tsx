// Route: /store/[slug]/admin/promo-popup
// The promo pop-up now lives in the Marketing workspace (CRM & Sales app > Promo pop-up tab).
import { redirect } from "next/navigation";

export default async function PromoPopupRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/apps/crm/marketing?tab=popup`);
}
