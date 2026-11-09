import { prisma } from "@/lib/prisma";
import { TableScroll } from "@/components/ui/table-scroll";
import { formatDate } from "@/lib/i18n/locale";
import { getVendorReferralConfig, defaultRuleForPrice, ruleForPlan } from "@/lib/referrals/vendor-config";
import { CancelRewardButton, ReferralConfigForm, WithdrawalReviewButtons } from "@/components/dashboard/referral-admin-client";

export const dynamic = "force-dynamic";

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const FLAG_LABEL: Record<string, string> = { same_ip: "Same network as another signup", same_phone: "Same phone as referrer", burst: "Many signups in 24h" };
const STATUS_LABEL: Record<string, string> = { SIGNED_UP: "On trial", PENDING: "Paid, on hold", CONFIRMED: "Confirmed", CANCELLED: "Cancelled" };

export default async function SupaAdminReferralsPage() {
  const config = await getVendorReferralConfig();
  const [byReferrer, paidByReferrer, statusCounts, rewardSums, paidOut, openReview, recentWithdrawals, flagged, recent, plans, flaggedCount] = await Promise.all([
    prisma.vendorReferral.groupBy({ by: ["referrerId"], _count: { _all: true } }),
    prisma.vendorReferral.groupBy({ by: ["referrerId"], where: { status: { in: ["PENDING", "CONFIRMED"] } }, _count: { _all: true }, _sum: { reward: true } }),
    prisma.vendorReferral.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vendorReferral.groupBy({ by: ["status"], where: { withdrawalId: null }, _sum: { reward: true } }),
    prisma.vendorReferralWithdrawal.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.vendorReferralWithdrawal.findMany({ where: { status: "REVIEW" }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } }),
    prisma.vendorReferralWithdrawal.findMany({ where: { status: { not: "REVIEW" } }, orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true, email: true } } } }),
    prisma.vendorReferral.findMany({
      where: { flags: { isEmpty: false }, status: { in: ["SIGNED_UP", "PENDING", "CONFIRMED"] }, withdrawalId: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { referrer: { select: { name: true, email: true } }, referee: { select: { name: true, email: true } } },
    }),
    prisma.vendorReferral.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { referrer: { select: { name: true, email: true } }, referee: { select: { name: true, email: true } } },
    }),
    prisma.subscription.findMany({ where: { isActive: true, isMarketingPlan: false, price: { gt: 0 } }, orderBy: { price: "asc" }, select: { id: true, name: true, price: true } }),
    prisma.vendorReferral.count({ where: { flags: { isEmpty: false } } }),
  ]);

  const count = (s: string) => statusCounts.find((x) => x.status === s)?._count._all ?? 0;
  const owed = (s: string) => Number(rewardSums.find((x) => x.status === s)?._sum.reward ?? 0);
  const paidMap = new Map(paidByReferrer.map((p) => [p.referrerId, p]));
  const top = [...byReferrer].sort((a, b) => (paidMap.get(b.referrerId)?._count._all ?? 0) - (paidMap.get(a.referrerId)?._count._all ?? 0) || b._count._all - a._count._all).slice(0, 10);
  const topUsers = await prisma.user.findMany({ where: { id: { in: top.map((t) => t.referrerId) } }, select: { id: true, name: true, email: true } });
  const nameOf = (id: string) => {
    const u = topUsers.find((x) => x.id === id);
    return u ? u.name ?? u.email : "Unknown";
  };

  const kpis: [string, string][] = [
    ["People who referred", byReferrer.length.toLocaleString()],
    ["Signups through referrals", (count("SIGNED_UP") + count("PENDING") + count("CONFIRMED") + count("CANCELLED")).toLocaleString()],
    ["Paid for a plan", (count("PENDING") + count("CONFIRMED")).toLocaleString()],
    ["Rewards on hold", naira(owed("PENDING"))],
    ["Owed to vendors (confirmed)", naira(owed("CONFIRMED"))],
    ["Paid out so far", naira(Number(paidOut._sum.amount ?? 0))],
    ["Cancelled", count("CANCELLED").toLocaleString()],
    ["Flagged", flaggedCount.toLocaleString()],
  ];

  const who = (u: { name: string | null; email: string }) => `${u.name ?? "No name"} (${u.email})`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Vendor referrals</h1>
        <p className="text-sm text-muted-foreground">Who is referring, who they brought, what is owed and what has been paid out.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {openReview.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Withdrawals waiting for your approval ({openReview.length})</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {openReview.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{naira(Number(w.amount))} to {w.bankName ?? "bank"} ••••{w.accountNumber.slice(-4)}</div>
                  <div className="text-xs text-muted-foreground">Vendor receives {naira(Number(w.amount) - Number(w.feeAmount))} after the transfer fee</div>
                  <div className="text-xs text-muted-foreground">{who(w.user)} · {formatDate(w.createdAt)}</div>
                </div>
                <WithdrawalReviewButtons id={w.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Top referrers</h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Referrer</th>
                    <th className="px-4 py-2 font-medium">Signups</th>
                    <th className="px-4 py-2 font-medium">Paid for a plan</th>
                    <th className="px-4 py-2 font-medium">Rewards earned</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => {
                    const p = paidMap.get(t.referrerId);
                    return (
                      <tr key={t.referrerId} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{nameOf(t.referrerId)}</td>
                        <td className="px-4 py-3">{t._count._all}</td>
                        <td className="px-4 py-3">{p?._count._all ?? 0}</td>
                        <td className="px-4 py-3">{naira(Number(p?._sum.reward ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </section>

      {flagged.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Flagged for a look</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {flagged.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{who(r.referrer)} referred {who(r.referee)}</div>
                  <div className="text-xs text-muted-foreground">{r.flags.map((f) => FLAG_LABEL[f] ?? f).join(" · ")} · {STATUS_LABEL[r.status] ?? r.status}</div>
                </div>
                <CancelRewardButton id={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent referrals</h2>
        <div className="overflow-hidden rounded-lg border">
          <TableScroll>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Referrer</th>
                  <th className="px-4 py-2 font-medium">Referred</th>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Reward</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{r.referrer.name ?? r.referrer.email}</td>
                    <td className="px-4 py-3">{r.referee.name ?? r.referee.email}</td>
                    <td className="px-4 py-3">{r.planName ?? "-"}</td>
                    <td className="px-4 py-3">
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.cancelReason ? <span className="block text-xs text-muted-foreground">{r.cancelReason}</span> : null}
                    </td>
                    <td className="px-4 py-3">{Number(r.reward) > 0 ? naira(Number(r.reward)) : "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{["SIGNED_UP", "PENDING", "CONFIRMED"].includes(r.status) && !r.withdrawalId ? <CancelRewardButton id={r.id} /> : null}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nothing yet.</td></tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent withdrawals</h2>
        {recentWithdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {recentWithdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{naira(Number(w.amount))} (fee {naira(Number(w.feeAmount))}) · {who(w.user)}</span>
                <span className="text-muted-foreground">{w.status}{w.lastError && w.status !== "PAID" ? ` · ${w.lastError}` : ""}</span>
                <span className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReferralConfigForm
        initial={{ enabled: config.enabled, holdDays: config.holdDays, reviewAbove: config.reviewAbove }}
        plans={plans.map((p) => {
          const rule = ruleForPlan(p, config) ?? defaultRuleForPrice(Number(p.price)) ?? { reward: 0, unlockCount: 1 };
          return { id: p.id, name: p.name, price: Number(p.price), reward: rule.reward, unlockCount: rule.unlockCount };
        })}
      />
    </div>
  );
}
