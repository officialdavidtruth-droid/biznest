import Link from "next/link";
import { listStores } from "@/lib/actions/admin";
import { StoreStatusButton } from "@/components/dashboard/store-status-button";

export default async function StoresPage() {
  const stores = await listStores();

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Stores</h1>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Store</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/store/${s.slug}`} target="_blank" className="font-medium text-primary hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">/store/{s.slug}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.business.user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <StoreStatusButton storeId={s.id} status={s.status} />
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No stores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
