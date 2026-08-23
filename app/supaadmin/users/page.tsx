import { listUsers, listPlans } from "@/lib/actions/admin";
import { UserPlanSelect, UserTrialControl, UserActionButtons } from "@/components/dashboard/user-plan-controls";
import { Search } from "lucide-react";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [users, plans] = await Promise.all([listUsers(q), listPlans()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
          Users ({users.length})
        </h1>
        <form className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="w-64 rounded-xl border py-2 pl-8 pr-3 text-xs outline-none"
            style={{ background: "hsl(var(--muted))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              {["User", "Email", "Plan", "Status", "Joined", "Actions"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                    >
                      {u.name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <span className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                      {u.name ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {u.email}
                </td>
                <td className="px-4 py-3">
                  <UserPlanSelect userId={u.id} store={u.business?.store ?? null} plans={plans} />
                  <div>
                    <UserTrialControl userId={u.id} store={u.business?.store ?? null} plans={plans} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={
                      u.isBanned
                        ? { background: "hsl(0 84% 65% / 0.12)", color: "hsl(0 84% 55%)" }
                        : { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }
                    }
                  >
                    {u.isBanned ? "Banned" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <UserActionButtons userId={u.id} email={u.email} isBanned={u.isBanned} businessName={u.business?.businessName ?? null} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
