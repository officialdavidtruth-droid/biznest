// Route: /store/[slug]/admin/staff
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import { listStaffMembers } from "@/lib/actions/staff";
import { StaffManager } from "@/components/dashboard/staff-manager";

export default async function StaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/staff`);

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) redirect(`/${slug}/admin`);

  const result = await listStaffMembers(slug);
  const members = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Staff accounts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Give employees access to your dashboard without sharing your login. <strong>Managers</strong> get
        everything except billing and staff management; <strong>Staff</strong> get products, services, orders,
        and messages only.
      </p>
      <StaffManager slug={slug} initialMembers={members} />
    </div>
  );
}
