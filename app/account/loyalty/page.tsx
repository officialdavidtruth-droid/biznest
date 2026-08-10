import { getLoyaltySummary, listRedeemableStores } from "@/lib/actions/loyalty";
import { LoyaltyCashoutForm } from "@/components/account/loyalty-cashout-form";
import { Gift } from "lucide-react";

export default async function LoyaltyPage() {
  const [{ pointsBalance, entries, rates }, stores] = await Promise.all([
    getLoyaltySummary(),
    listRedeemableStores(),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Gift className="h-4 w-4" /> BizNest Loyalty
        </div>
        <div className="mt-2 text-4xl font-extrabold">{pointsBalance.toLocaleString()} pts</div>
        <p className="mt-1 text-sm text-slate-300">
          Earn {rates.pointsPerNaira} point{rates.pointsPerNaira === 1 ? "" : "s"} per ₦1 spent. 1 point = ₦{rates.nairaPerPoint} when cashed out.
        </p>
      </div>

      <LoyaltyCashoutForm pointsBalance={pointsBalance} nairaPerPoint={rates.nairaPerPoint} stores={stores} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet — points appear here once an order completes.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">
                    {entry.type === "EARN" ? "Earned" : entry.type === "REDEEM" ? "Cashed out" : "Adjustment"}
                  </div>
                  {entry.note && <div className="text-xs text-slate-500">{entry.note}</div>}
                  <div className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleDateString()}</div>
                </div>
                <div className={`font-semibold ${entry.points > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                  {entry.points > 0 ? "+" : ""}{entry.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
