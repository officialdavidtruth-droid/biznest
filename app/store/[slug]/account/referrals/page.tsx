import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getMyReferralInfo } from "@/lib/actions/referral";
import { ReferralPanel } from "@/components/account/referral-panel";
import { APP_URL } from "@/lib/constants/app-url";
import { formatDate, formatNumber } from "@/lib/i18n/locale";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, info] = await Promise.all([getStoreBranding(slug), getMyReferralInfo(slug)]);
  if (!store || !info) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Refer a friend</h1>
        <p className="text-sm text-muted-foreground">Share {store.name} with friends and earn rewards.</p>
      </div>

      {!info.enabled || !info.code ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">{store.name} isn&apos;t running a referral program right now.</p>
      ) : (
        <>
          <p className="text-sm">
            When a friend joins with your code and their first order is completed, you get <strong>{formatNumber(info.referrerPoints)} points</strong>
            {info.refereePoints > 0 ? <> and they get <strong>{formatNumber(info.refereePoints)} points</strong></> : null}.
          </p>
          <ReferralPanel
            slug={slug}
            code={info.code}
            appliedCode={info.appliedCode}
            shareUrl={`${APP_URL}/register?store=${encodeURIComponent(slug)}&ref=${info.code}`}
          />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Your referrals</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2">Friend</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Points</th><th className="px-4 py-2">Date</th></tr>
                </thead>
                <tbody>
                  {info.referrals.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{r.friend}</td>
                      <td className="px-4 py-3">{r.status === "REWARDED" ? "Rewarded" : r.status === "PENDING" ? "Waiting for their first order" : "Cancelled"}</td>
                      <td className="px-4 py-3">{r.status === "REWARDED" ? `+${r.points}` : "—"}</td>
                      <td className="px-4 py-3">{formatDate(new Date(r.createdAt))}</td>
                    </tr>
                  ))}
                  {info.referrals.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No referrals yet — share your code to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
