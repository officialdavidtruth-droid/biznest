import { growthToolsGate } from "@/lib/entitlements/plan-features";
import { PlanUpgradeNotice } from "@/components/dashboard/plan-upgrade-notice";
// Route: /store/[slug]/admin/referrals
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { ReferralSettingsForm } from "@/components/dashboard/referral-settings-form";
import { ReferralRowActions } from "@/components/dashboard/referral-row-actions";
import { formatDate } from "@/lib/i18n/locale";
import { TableScroll } from "@/components/ui/table-scroll";

const PAGE_SIZE = 25;

export default async function ReferralsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  // Layout redirects don't reliably re-run on in-app navigation, so the page checks for itself.
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) redirect(`/store/${slug}/admin`);
  const store = access.store;
  const gate = await growthToolsGate(slug, "Referrals");
  if (!gate.ok) return <PlanUpgradeNotice slug={slug} title="Referrals" message={gate.message} />;

  const [total, rewarded, waiting] = await Promise.all([
    prisma.referral.count({ where: { storeId: store.id } }),
    prisma.referral.count({ where: { storeId: store.id, status: "REWARDED" } }),
    prisma.referral.count({ where: { storeId: store.id, status: "PENDING" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1));

  const referrals = await prisma.referral.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, status: true, referrerPoints: true, refereePoints: true, promisedReferrerPoints: true, promisedRefereePoints: true,
      note: true, createdAt: true, rewardedAt: true,
      referrer: { select: { name: true } },
      referee: { select: { name: true } },
    },
  });

  const statusLabel = (r: (typeof referrals)[number]) => {
    if (r.status === "REWARDED") return "Rewarded";
    if (r.status === "REVERSED") return "Reversed";
    if (r.status === "CANCELLED") return "Cancelled";
    return !store.referralEnabled ? "On hold — program paused" : "Waiting for first order";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Referrals</h1>
      <ReferralSettingsForm
        slug={slug}
        initial={{
          enabled: store.referralEnabled,
          referrerPoints: store.referralReferrerPoints,
          refereePoints: store.referralRefereePoints,
          minOrderAmount: Number(store.referralMinOrderAmount ?? 0),
          maxRewardsPerReferrer: store.referralMaxRewardsPerReferrer,
          expiryDays: store.referralExpiryDays,
        }}
      />
      <p className="text-sm text-muted-foreground">
        {total} referral{total === 1 ? "" : "s"}, {rewarded} rewarded, {waiting} waiting.
      </p>
      <TableScroll className="rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Referred by</th><th className="px-4 py-2">New customer</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Points</th><th className="px-4 py-2">Joined</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">{r.referrer.name ?? "—"}</td>
                <td className="px-4 py-3">{r.referee.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {statusLabel(r)}
                  {r.note && <div className="mt-0.5 text-xs text-muted-foreground">{r.note}</div>}
                </td>
                <td className="px-4 py-3">
                  {r.status === "REWARDED" || r.status === "REVERSED"
                    ? `${r.referrerPoints} + ${r.refereePoints}`
                    : r.status === "PENDING"
                      ? `${r.promisedReferrerPoints ?? store.referralReferrerPoints} + ${r.promisedRefereePoints ?? store.referralRefereePoints} promised`
                      : "—"}
                </td>
                <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3">{r.status === "PENDING" && <ReferralRowActions slug={slug} referralId={r.id} />}</td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No referrals yet.</td></tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="rounded-md border px-3 py-1.5">Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={`?page=${page + 1}`} className="rounded-md border px-3 py-1.5">Next</Link> : <span />}
        </div>
      )}
    </div>
  );
}
