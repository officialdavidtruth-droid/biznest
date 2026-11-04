// Route: /store/[slug]/deals
// "Deals" is the catalog: it lives in the template's own header/footer like every other shop page.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DealsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  redirect(`/store/${slug}/catalog`);
}
