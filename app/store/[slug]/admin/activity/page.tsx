// Route: /store/[slug]/admin/activity
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import { listStoreActivity } from "@/lib/actions/activity";

const ACTION_LABELS: Record<string, string> = {
  "staff.invited": "invited a staff member",
  "staff.reinvited": "re-invited a staff member",
  "staff.joined": "accepted a staff invite",
  "staff.access_updated": "updated a staff member's access",
  "staff.removed": "removed a staff member",
  "product.created": "created a product",
  "product.updated": "edited a product",
  "product.deleted": "deleted a product",
  "order.status_updated": "updated an order's status",
};

function describe(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/activity`);

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) redirect(`/${slug}/admin`);

  const result = await listStoreActivity(slug);
  const entries = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Activity log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What your staff and managers have been doing in this store's dashboard.
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <div className="mt-6 divide-y divide-border rounded-lg border border-border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{e.actorName}</span>{" "}
                  <span className="text-muted-foreground">({e.actorEmail})</span> {describe(e.action)}
                  {e.target ? <span className="text-muted-foreground"> — {e.target}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.actorRole} ·{" "}
                  {new Date(e.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
