// Route: /store/[slug]/admin/referrals
import { prisma } from "@/lib/prisma";
import { ReferralSettingsForm } from "@/components/dashboard/referral-settings-form";

export default async function ReferralsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, referralEnabled: true, referralReferrerPoints: true, referralRefereePoints: true },
  });
  if (!store) return null;

  const referrals = await prisma.referral.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, status: true, referrerPoints: true, refereePoints: true, createdAt: true, rewardedAt: true,
      referrer: { select: { name: true } },
      referee: { select: { name: true } },
    },
  });
  const rewarded = referrals.filter((r) => r.status === "REWARDED").length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Referrals</h1>
      <ReferralSettingsForm
        slug={slug}
        initial={{ enabled: store.referralEnabled, referrerPoints: store.referralReferrerPoints, refereePoints: store.referralRefereePoints }}
      />
      <p className="text-sm text-muted-foreground">{referrals.length} referral{referrals.length === 1 ? "" : "s"}, {rewarded} rewarded.</p>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Referred by</th><th className="px-4 py-2">New customer</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Points paid</th><th className="px-4 py-2">Joined</th></tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3">{r.referrer.name ?? "—"}</td>
                <td className="px-4 py-3">{r.referee.name ?? "—"}</td>
                <td className="px-4 py-3">{r.status === "REWARDED" ? "Rewarded" : r.status === "PENDING" ? "Waiting for first order" : "Cancelled"}</td>
                <td className="px-4 py-3">{r.status === "REWARDED" ? `${r.referrerPoints} + ${r.refereePoints}` : "—"}</td>
                <td className="px-4 py-3">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No referrals yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
