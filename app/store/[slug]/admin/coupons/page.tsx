import { prisma } from "@/lib/prisma";
import { createCoupon } from "@/lib/actions/coupon";

export default async function CouponsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const coupons = await prisma.coupon.findMany({ where: { storeId: store.id }, orderBy: { id: "desc" } });
  const createCouponForStore = createCoupon.bind(null, slug);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Coupons</h1>

      <form action={createCouponForStore} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:grid-cols-5">
        <input name="code" placeholder="CODE20" required className="rounded-md border px-3 py-1.5 text-sm sm:col-span-1" />
        <select name="discountType" className="rounded-md border px-3 py-1.5 text-sm">
          <option value="PERCENT">% off</option>
          <option value="FIXED">₦ off</option>
        </select>
        <input name="discountValue" type="number" min="0" placeholder="20" required className="rounded-md border px-3 py-1.5 text-sm" />
        <input name="maxUses" type="number" min="0" placeholder="Max uses (optional)" className="rounded-md border px-3 py-1.5 text-sm" />
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Create coupon</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Discount</th><th className="px-4 py-2">Used</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                <td className="px-4 py-3">{c.discountType === "PERCENT" ? `${c.discountValue}%` : `₦${Number(c.discountValue).toLocaleString()}`}</td>
                <td className="px-4 py-3">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No coupons yet — create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
