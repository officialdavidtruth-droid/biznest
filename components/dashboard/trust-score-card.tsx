import type { TrustScoreBreakdown } from "@/lib/actions/trust-score";

function scoreColor(score: number) {
  if (score >= 80) return { text: "text-[var(--bn-admin-orange)]", ring: "stroke-[var(--bn-admin-orange)]", bg: "bg-[var(--bn-admin-surface-2)]" };
  if (score >= 60) return { text: "text-[var(--bn-admin-orange)]", ring: "stroke-[var(--bn-admin-orange)]", bg: "bg-[var(--bn-admin-surface-2)]" };
  if (score >= 40) return { text: "text-[var(--bn-admin-orange)]", ring: "stroke-[var(--bn-admin-orange)]", bg: "bg-[var(--bn-admin-orange-soft)]" };
  return { text: "text-[var(--bn-admin-danger)]", ring: "stroke-[var(--bn-admin-danger)]", bg: "bg-[var(--bn-admin-danger-soft)]" };
}

export function TrustScoreCard({ breakdown, compact = false }: { breakdown: TrustScoreBreakdown; compact?: boolean }) {
  const { score, factors } = breakdown;
  const colors = scoreColor(score);
  const circumference = 2 * Math.PI * 40;
  const dash = (score / 100) * circumference;

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="50" cy="50" r="40" fill="none" strokeWidth="10" strokeLinecap="round"
              className={colors.ring}
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-extrabold ${colors.text}`}>{score}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">BizNest Trust Score</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A blended measure of verification, reliability, and how buyers have actually been treated —
            beyond a simple star rating.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 space-y-2 border-t pt-4">
          {factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground">{Math.round(f.points)} / {f.max}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${colors.ring.replace("stroke-", "bg-")}`} style={{ width: `${(f.points / f.max) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
