import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostsTab } from "@/components/dashboard/browse-tabs";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, status: true, business: { select: { searchVisible: true } }, products: { where: { isPublished: true, archivedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 200 } },
  });
  if (!store) notFound();
  return <PostsTab slug={slug} store={store} />;
}
