import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function StoreAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin`);

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true },
  });

  if (!store) notFound();

  const isOwner = store.business.userId === session.user.id;
  const isPlatformStaff = ["PLATFORM_ADMIN", "SUPPORT_MODERATOR"].includes(session.user.role);

  if (!isOwner && !isPlatformStaff) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar slug={slug} storeName={store.name} />
      <main className="flex-1 bg-muted/20 p-6">{children}</main>
    </div>
  );
}
