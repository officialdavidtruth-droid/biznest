import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { WorkflowCenter } from "@/components/dashboard/workflow-center";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params; const session = await auth();
 if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/approvals`);
 const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true } });
 if (!store) notFound();
 return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Approvals</h1><p className="mt-1 text-sm text-muted-foreground">Review sensitive actions with a clear audit trail.</p></div><div className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Approval queue</h2><p className="mt-2 text-sm text-muted-foreground">Requests are store-scoped and can only be decided through authenticated server actions.</p></div><WorkflowCenter slug={slug} kind="approvals" /></div>;
}
