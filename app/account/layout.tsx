import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Customer accounts are no longer platform-global. This legacy route exists
// only as a compatibility boundary for old bookmarks; it never renders a
// cross-store dashboard.
export default async function LegacyAccountBoundary({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const memberships = await prisma.storeCustomer.findMany({ where: { userId: session.user.id }, select: { store: { select: { slug: true } } }, take: 2 });
  if (memberships.length === 1) redirect(`/store/${memberships[0].store.slug}/account`);
  // A customer with more than one membership must never see a combined
  // account. The legacy shell is intentionally inert.
  return <div className="mx-auto max-w-xl px-6 py-20 text-center"><h1 className="text-xl font-bold">Store account required</h1><p className="mt-2 text-sm text-slate-500">Customer accounts are private to each store. Open your account from the store you signed up with.</p>{children}</div>;
}
