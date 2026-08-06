import { listActivityLogs, listDistinctLogActions } from "@/lib/actions/admin";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  const { q, action, page } = await searchParams;
  const pageNum = Number(page ?? "1") || 1;

  const [{ logs, total, pageSize = 50 }, actions] = await Promise.all([
    listActivityLogs({ query: q, action, page: pageNum }),
    listDistinctLogActions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Activity log</h1>
          <p className="text-sm text-muted-foreground">Every admin and system action on the platform, most recent first.</p>
        </div>
      </div>

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by user email, entity, or ID…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select name="action" defaultValue={action ?? ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">Filter</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {log.user ? (
                    <>
                      <p className="font-medium">{log.user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{log.user.email}</p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">System</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {log.entity}
                  <br />
                  <span className="text-xs">{log.entityId}</span>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground" title={log.metadata ? JSON.stringify(log.metadata) : ""}>
                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No activity found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(action ? { action } : {}), page: String(p) })}`}
              className={`rounded-md px-2.5 py-1 ${p === pageNum ? "bg-primary text-primary-foreground" : "border"}`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
