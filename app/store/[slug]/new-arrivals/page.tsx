// Route: /store/[slug]/new-arrivals
// New arrivals is the catalog (newest first), drawn by the template like every other shop page.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  redirect(`/store/${slug}/catalog`);
}
