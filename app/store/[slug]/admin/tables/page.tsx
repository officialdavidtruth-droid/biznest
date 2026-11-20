// Route: /store/[slug]/admin/tables — restaurant tables and their QR codes.
import { redirect } from "next/navigation";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { TablesPanel } from "@/components/dashboard/tables-panel";

export default async function TablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "products");
  if (!access.success) redirect(`/store/${slug}/admin`);
  return <div className="bn-admin-page"><TablesPanel slug={slug} /></div>;
}
