// Route: /store/[slug]/admin/refer-and-earn
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStoreOwnerAccess } from "@/lib/access/assert-store-access";
import { APP_URL } from "@/lib/constants/app-url";
import { ensureVendorReferralCode, getWallet } from "@/lib/referrals/vendor-referral";
import { getVendorReferralConfig, defaultRuleForPrice, ruleForPlan } from "@/lib/referrals/vendor-config";
import { CopyReferralLink, WithdrawButton } from "@/components/dashboard/vendor-referral-client";
import { formatDate } from "@/lib/i18n/locale";
import { TableScroll } from "@/components/ui/table-scroll";

export const dynamic = "force-dynamic";

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const STATUS_LABEL: Record<string, string> = {
  SIGNED_UP: "On free trial",
  PENDING: "Paid, reward on hold",
  CONFIRMED: "Reward earned",
  CANCELLED: "Cancelled",
};
const WITHDRAWAL_LABEL: Record<string, string> = {
  REVIEW: "Waiting for approval",
  QUEUED: "Sending",
  PROCESSING: "Sending",
  PAID: "Paid",
  FAILED: "Failed, money returned to wallet",
  CANCELLED: "Declined, money returned to wallet",
};

export default async function ReferAndEarnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStoreOwnerAccess(slug);
  if (!access.success) redirect(`/store/${slug}/admin`);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const config = await getVendorReferralConfig();
  const [code, wallet, referrals, withdrawals, plans] = await Promise.all([
    ensureVendorReferralCode(userId),
    getWallet(userId),
    prisma.vendorReferral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, status: true, planName: true, reward: true, createdAt: true, confirmAt: true, referee: { select: { name: true } } },
    }),
    prisma.vendorReferralWithdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, amount: true, status: true, createdAt: true, lastError: true } }),
    prisma.subscription.findMany({ where: { isActive: true, isMarketingPlan: false, price: { gt: 0 } }, orderBy: { price: "asc" }, select: { id: true, name: true, price: true } }),
  ]);
  const link = code ? `${APP_URL}/register?ref=${code}` : null;
  const store = await prisma.store.findUnique({ where: { slug }, select: { payoutBankCode: true, payoutAccountNumber: true } });
  const hasBank = Boolean(store?.payoutBankCode && store.payoutAccountNumber);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Refer & earn</h1>
        <p className="text-sm text-muted-foreground">Earn cash when a vendor you refer pays for a BizNest plan.</p>
      </div>

      {!config.enabled && <p className="rounded-lg border bg-muted p-3 text-sm">The referral program is paused right now. Rewards already earned are safe.</p>}

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Your referral link</h2>
        {link ? <CopyReferralLink link={link} /> : <p className="text-sm text-muted-foreground">Your link isn't ready yet. Refresh the page.</p>}
        <p className="text-xs text-muted-foreground">Your code is <span className="font-semibold">{code}</span>. People must sign up through this link. Their 14-day free trial still applies, and you earn only after they pay for a plan.</p>
      </section>

      <section className="space-y-4 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Referral wallet</h2>
          <WithdrawButton slug={slug} amount={wallet.withdrawable} disabled={wallet.withdrawable <= 0 || !hasBank || wallet.inFlight > 0} />
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Ready to withdraw", naira(wallet.withdrawable)],
            ["Earned, still locked", naira(wallet.locked)],
            ["On hold (refund window)", naira(wallet.pending)],
            ["Withdrawn so far", naira(wallet.withdrawn)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {!hasBank && <p className="text-xs text-amber-600">Connect your bank account in Payouts so you can withdraw.</p>}
        {wallet.inFlight > 0 && <p className="text-xs text-muted-foreground">A withdrawal of {naira(wallet.inFlight)} is in progress.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">How rewards work</h2>
        <div className="overflow-hidden rounded-lg border">
          <TableScroll>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">When they pay for</th>
                  <th className="px-4 py-2 font-medium">You earn</th>
                  <th className="px-4 py-2 font-medium">Withdraw after</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const rule = ruleForPlan(p, config) ?? defaultRuleForPrice(Number(p.price));
                  if (!rule) return null;
                  const mine = wallet.groups.find((g) => g.planName === p.name);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">{naira(rule.reward)} each</td>
                      <td className="px-4 py-3">
                        {rule.unlockCount} paying referrals
                        {mine ? <span className="block text-xs text-muted-foreground">{mine.withdrawableCount > 0 ? "Unlocked" : `${mine.confirmed} of ${rule.unlockCount} so far`}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
        <p className="text-xs text-muted-foreground">
          Each plan is counted on its own. A reward is held for {config.holdDays} days after the payment in case of a refund. After you withdraw, the count starts again.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">People you referred</h2>
        {referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one yet. Share your link to get started.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Person</th>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Reward</th>
                    <th className="px-4 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{(r.referee.name ?? "New vendor").split(" ")[0]}</td>
                      <td className="px-4 py-3">{r.planName ?? "-"}</td>
                      <td className="px-4 py-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="px-4 py-3">{Number(r.reward) > 0 && r.status !== "CANCELLED" ? naira(Number(r.reward)) : "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </section>

      {withdrawals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Withdrawals</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{naira(Number(w.amount))}</span>
                <span className="text-muted-foreground">{WITHDRAWAL_LABEL[w.status] ?? w.status}</span>
                <span className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
