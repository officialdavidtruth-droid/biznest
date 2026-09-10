import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { WorkflowCenter } from "@/components/dashboard/workflow-center";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params; const session = await auth();
 if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/automations`);
 const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true } });
 if (!store) notFound();
 return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Automations</h1><p className="mt-1 text-sm text-muted-foreground">Build reusable trigger → condition → action workflows.</p></div><div className="rounded-2xl border bg-card p-6 space-y-4"><h2 className="font-semibold">Create an automation</h2><p className="text-sm text-muted-foreground">Examples: invoice overdue → notify accountant; inventory low → notify manager; booking confirmed → notify customer.</p><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border p-4"><b>Trigger</b><p className="text-xs text-muted-foreground mt-1">ORDER_CREATED, PAYMENT_RECEIVED, INVOICE_OVERDUE, INVENTORY_LOW, BOOKING_CONFIRMED</p></div><div className="rounded-xl border p-4"><b>Conditions</b><p className="text-xs text-muted-foreground mt-1">Match event fields without exposing database access to the browser.</p></div><div className="rounded-xl border p-4"><b>Actions</b><p className="text-xs text-muted-foreground mt-1">Notify staff, create approval, log activity, or call an approved internal action.</p></div></div></div><WorkflowCenter slug={slug} kind="automations" /></div>;
}
