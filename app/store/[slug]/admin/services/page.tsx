import { prisma } from "@/lib/prisma";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const services = await prisma.service.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Services</h1>
        <span className="text-xs text-muted-foreground">{services.length} listed</span>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Service</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Duration</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.currency} {Number(s.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.durationMins ? `${s.durationMins} min` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {s.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No services yet. Add one from Website Builder.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
