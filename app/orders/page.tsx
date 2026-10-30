import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Legacy cross-store orders URL. Customer accounts belong to one store, so this
// just forwards to that store's order list.
export default async function LegacyOrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.storeCustomer.findFirst({
    where: { userId: session.user.id },
    select: { store: { select: { slug: true } } },
  });
  if (membership) redirect(`/store/${membership.store.slug}/account/orders`);

  // Signed in but not a customer of any store: nothing to list here.
  redirect("/");
}
