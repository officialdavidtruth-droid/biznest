import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { WorkflowCenter } from "@/components/dashboard/workflow-center";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params; const session = await auth();
 if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/reports-builder`);
 const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true } });
 if (!store) notFound();
 return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Report Builder</h1><p className="mt-1 text-sm text-muted-foreground">Save reusable report definitions from your existing analytics data.</p></div><div className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Saved report definitions</h2><p className="mt-2 text-sm text-muted-foreground">Use this layer to save report sources, fields, filters, grouping and delivery schedules on top of existing Analytics.</p></div><WorkflowCenter slug={slug} kind="reports" /></div>;
}
