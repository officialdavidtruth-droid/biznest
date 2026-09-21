// Route: /store/[slug]/admin/marketing
// Email marketing moved into the CRM & Sales app. This keeps old links and bookmarks working.
import { redirect } from "next/navigation";

export default async function LegacyMarketingRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/apps/crm/marketing`);
}
