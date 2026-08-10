import { SupplierForm } from "@/components/dashboard/supplier-form";

export default async function NewSupplierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Add supplier</h1>
      <SupplierForm storeSlug={slug} />
    </div>
  );
}
