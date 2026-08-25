import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { RecoverOrderForm } from "@/components/forms/recover-order-form";

export default async function RecoverOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const membership = await requireStoreCustomer(slug);
  if (!membership) notFound();

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <Link
        href={`/store/${slug}/orders`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to my orders
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Recover a lost order</h1>
      <div className="mt-5">
        <RecoverOrderForm storeSlug={slug} storeName={store.name} />
      </div>
    </div>
  );
}
