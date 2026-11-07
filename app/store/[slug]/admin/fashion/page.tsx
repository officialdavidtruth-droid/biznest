import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usesTailoring } from "@/lib/tailoring-eligibility";
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
  const biz = await prisma.store.findUnique({ where: { slug }, select: { business: { select: { category: true, businessSubcategory: true } } } });
  const enabled = usesTailoring(biz?.business?.category, biz?.business?.businessSubcategory);
  const hasJobs = result.jobs.length > 0 || result.requests.length > 0;
  if (!enabled && !hasJobs) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Made-to-measure work isn't part of your {biz?.business?.businessSubcategory ?? "shop"} setup. If you also sew to order, change your specialty to Tailoring & Bespoke in Settings.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fashion & Tailoring Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track made-to-measure jobs from first measurements to delivery, with deposits, balances, photos, who is making what, and a status link your customers can pay from.</p>
      </div>
      <TailoringWorkspace slug={slug} initial={result.jobs} initialRequests={result.requests} currency={result.currency} autoNotify={result.autoNotify} orderFormPath={result.orderFormPath} />
    </div>
  );
}
