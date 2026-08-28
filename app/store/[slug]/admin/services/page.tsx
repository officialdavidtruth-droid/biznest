// Route: /store/[slug]/admin/services
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const services = await prisma.service.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Services</h1>
        <Link href={`/${slug}/admin/services/new`} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          + Add service
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Service</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Booking</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.currency} {Number(s.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.isBookable ? `${s.durationMins ?? "—"} min slots` : "Not bookable"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {s.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${slug}/admin/services/${s.id}/edit`} className="text-xs font-medium text-primary hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No services yet — add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
