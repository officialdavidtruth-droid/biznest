// Route: /store/[slug]/favorites
// Saved items live in the customer account.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  redirect(`/store/${slug}/account`);
}
