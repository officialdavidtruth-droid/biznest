import { prisma } from "@/lib/prisma";
import { AUDIENCES, audienceWhere } from "@/lib/platform-email/audience";
import { CampaignComposer, ContinueSendingButton } from "@/components/dashboard/campaign-composer";
import { TableScroll } from "@/components/ui/table-scroll";
import { formatDate } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";
// Sending a batch happens inside the server action on this page.
export const maxDuration = 60;

export default async function CampaignsPage() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [counts, campaigns, optedOut, reminders] = await Promise.all([
    Promise.all(AUDIENCES.map((a) => prisma.user.count({ where: audienceWhere(a.value) }))),
    prisma.platformCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.user.count({ where: { customerScopeStoreId: null, isMarketingOnly: false, platformEmailOptOutAt: { not: null } } }),
    prisma.platformEmailLog.groupBy({ by: ["kind"], where: { kind: { startsWith: "REMINDER_" }, createdAt: { gte: weekAgo } }, _count: { _all: true } }),
  ]);

  const audiences = AUDIENCES.map((a, i) => ({ value: a.value, label: a.label, hint: a.hint, count: counts[i] }));
  const reminderCount = (stage: number) => reminders.find((r) => r.kind === `REMINDER_${stage}`)?._count._all ?? 0;

  // Campaigns that are still mid-send need to know how many people are left.
  const remaining = new Map<string, number>();
  await Promise.all(
    campaigns
      .filter((c) => c.status === "SENDING")
      .map(async (c) => {
        const a = AUDIENCES.find((x) => x.value === c.audience);
        if (!a) return;
        remaining.set(c.id, await prisma.user.count({ where: { ...audienceWhere(a.value), platformEmailLogs: { none: { kind: `CAMPAIGN:${c.id}` } } } }));
      })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Emails to users</h1>
        <p className="text-sm text-muted-foreground">
          Reminders and promotional emails from BizNest itself. Every email has an unsubscribe link, and people who unsubscribe are skipped automatically.
        </p>
      </div>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Signup reminders (automatic)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each day at 10:00 Lagos time, verified accounts with no store get a reminder 1, 3 and 7 days after signing up. Approved businesses without a store get the same
          sequence with an &ldquo;open your store&rdquo; button. They stop as soon as a store exists.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Day 1, last 7 days", reminderCount(1)],
            ["Day 3, last 7 days", reminderCount(2)],
            ["Day 7, last 7 days", reminderCount(3)],
            ["Unsubscribed (total)", optedOut],
          ].map(([label, n]) => (
            <div key={String(label)} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold">{Number(n).toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CampaignComposer audiences={audiences} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Sent emails</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet. Write an email above, send yourself a test, then send it to an audience.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <TableScroll>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Subject</th>
                    <th className="px-4 py-2 font-medium">Audience</th>
                    <th className="px-4 py-2 font-medium">Sent</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.subject}</td>
                      <td className="px-4 py-3">{AUDIENCES.find((a) => a.value === c.audience)?.label ?? c.audience}</td>
                      <td className="px-4 py-3">{c.sentCount.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        {c.status === "SENDING" ? <ContinueSendingButton campaignId={c.id} remaining={remaining.get(c.id) ?? 0} /> : "Sent"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </section>
    </div>
  );
}
