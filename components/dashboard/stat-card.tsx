export function StatCard({ icon: Icon, tone, label, value, note }: { icon: any; tone: "purple" | "orange" | "green" | "red" | "blue"; label: string; value: string | number; note: string }) {
  const toneClass = tone === "purple" ? "bg-violet-50 text-violet-600" : tone === "orange" ? "bg-orange-50 text-orange-500" : tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-500";
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-5 w-5" /></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
