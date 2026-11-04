// Route: /store/[slug]/review
// There is no separate review step: checkout is the review.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  redirect(`/store/${slug}/checkout`);
}
