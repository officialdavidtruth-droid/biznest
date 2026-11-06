import { loadPaystackReadiness } from "@/lib/actions/paystack-readiness";

export const dynamic = "force-dynamic";

const badge: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  fail: "bg-red-100 text-red-800",
  manual: "bg-slate-100 text-slate-700",
};
const word: Record<string, string> = { ok: "Ready", warn: "Check", fail: "Fix", manual: "Do in Paystack" };

export default async function PaystackReadinessPage() {
  const r = await loadPaystackReadiness();
  if (!r.success) return <p role="alert" className="text-sm text-destructive">{r.error}</p>;
  const { checks, live, blockers } = r.data;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Paystack go-live check</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {live ? "Live keys are in place." : "Not on live keys yet."}{" "}
          {blockers > 0 ? `${blockers} thing${blockers === 1 ? "" : "s"} to fix before real payments will work.` : "Nothing is blocking payments. Finish the Paystack dashboard steps below."}
        </p>
      </div>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{c.label}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[c.status]}`}>{word[c.status]}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
            {c.fix && <p className="mt-1 text-sm"><b>Fix:</b> {c.fix}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Reload this page after changing keys in Vercel and redeploying.</p>
    </div>
  );
}
