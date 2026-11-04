// Route: /store/[slug]/categories
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderBuilderSubpage } from "@/lib/storefront/builder-subpage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const builder = await renderBuilderSubpage(slug, "categories");
  if (builder) return builder;
  notFound();
}
