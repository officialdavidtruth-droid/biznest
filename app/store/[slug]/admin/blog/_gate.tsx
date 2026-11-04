import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** Posts are a core part of every store (like WordPress): no app install, plan or business-type gate. */
export async function requireBlogApp(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
}
