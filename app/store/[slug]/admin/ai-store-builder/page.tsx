import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { AiStoreBuilderForm } from "@/components/dashboard/ai-store-builder-form";

export default async function AiStoreBuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/ai-store-builder`);

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true, subscription: true },
  });
  if (!store) notFound();
  if (store.business.userId !== session.user.id) redirect("/");

  const features = (store.subscription?.features ?? {}) as { aiStoreBuilder?: boolean };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">AI Store Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe your business in a sentence or two. We'll draft your homepage copy, colors, categories,
        FAQ, SEO, and more — you can edit everything before it goes live.
      </p>

      {!features.aiStoreBuilder ? (
        <div className="mt-6 rounded-lg border border-border p-4 text-sm">
          This is available on the <strong>Custom AI-Built Store</strong> or <strong>Business Mogul</strong> plan.{" "}
          <a href={`/${slug}/admin/subscription`} className="text-primary underline">
            Upgrade your plan
          </a>{" "}
          to use it.
        </div>
      ) : (
        <AiStoreBuilderForm slug={slug} defaultDescription={store.business.description ?? ""} />
      )}
    </div>
  );
}
