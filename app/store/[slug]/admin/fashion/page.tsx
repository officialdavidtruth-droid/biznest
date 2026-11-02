import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { listTailoringJobs } from "@/lib/actions/tailoring";
import { TailoringWorkspace } from "@/components/dashboard/tailoring-workspace";

export default async function FashionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/fashion`);

  // Same gate as the tailoring actions: owners, or staff granted "Products & inventory".
  const access = await assertStorePermission(slug, "products");
  if (!access.success) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{access.error}</div>;
  }
  const result = await listTailoringJobs(slug);
  if ("error" in result) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{result.error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fashion & Tailoring Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track made-to-measure jobs from first measurements to delivery.</p>
      </div>
      <TailoringWorkspace slug={slug} initial={result.jobs} />
    </div>
  );
}
