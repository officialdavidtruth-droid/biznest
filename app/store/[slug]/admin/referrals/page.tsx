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
      <div className="grid grid-cols-3 gap-3">
        {[["Referrals", total], ["Rewarded", rewarded], ["Waiting", waiting]].map(([l, n]) => (
          <div key={String(l)} className="rounded-2xl border bg-background p-3 shadow-sm sm:p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      {referrals.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No referrals yet. When a customer shares their link and a friend signs up, it shows here.
        </div>
      ) : (
        <ul className="space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.referee.name ?? "New customer"}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">Referred by {r.referrer.name ?? "—"} · {formatDate(r.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${r.status === "REWARDED" ? "bg-emerald-100 text-emerald-800" : r.status === "PENDING" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                  {statusLabel(r)}
                </span>
              </div>
              {r.note && <p className="mt-2 text-xs text-muted-foreground">{r.note}</p>}
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Points: </span>
                <span className="font-semibold tabular-nums">
                  {r.status === "REWARDED" || r.status === "REVERSED"
                    ? `${r.referrerPoints} + ${r.refereePoints}`
                    : r.status === "PENDING"
                      ? `${r.promisedReferrerPoints ?? store.referralReferrerPoints} + ${r.promisedRefereePoints ?? store.referralRefereePoints} promised`
                      : "—"}
                </span>
              </p>
              {r.status === "PENDING" && (
                <div className="mt-3 border-t pt-3"><ReferralRowActions slug={slug} referralId={r.id} /></div>
              )}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="rounded-xl border px-4 py-2 font-medium">Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={`?page=${page + 1}`} className="rounded-xl border px-4 py-2 font-medium">Next</Link> : <span />}
        </div>
      )}
    </div>
  );
}
