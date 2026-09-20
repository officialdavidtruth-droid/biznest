export function StatCard({ icon: Icon, tone, label, value, note }: { icon: any; tone: "purple" | "orange" | "green" | "red" | "blue"; label: string; value: string | number; note: string }) {
  const toneClass = tone === "purple" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]" : tone === "orange" ? "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-orange-soft)] dark:text-[var(--bn-admin-orange)]" : tone === "green" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]" : tone === "blue" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]" : "bg-[var(--bn-admin-danger-soft)] text-[var(--bn-admin-danger)] dark:bg-[var(--bn-admin-danger-soft)] dark:text-[var(--bn-admin-danger)]";
  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm dark:border-[var(--bn-admin-border)] dark:bg-[var(--bn-admin-page)] dark:text-[var(--bn-admin-muted)]">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-5 w-5" /></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
