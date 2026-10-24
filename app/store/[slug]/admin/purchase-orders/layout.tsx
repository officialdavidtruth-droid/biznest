import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { getProcurementGate } from "@/lib/access/procurement-access";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

// Suppliers and purchase orders are part of the Procurement & Vendors app.
export default async function ProcurementRouteLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await getProcurementGate(slug);
  if (!gate.ok) {
    if (gate.reason === "denied") redirect(`/store/${slug}/admin`);
    return <PluginInstallGate slug={slug} title="Procurement & Vendors" message={gate.message} icon={Truck} />;
  }
  return (
    <div className="space-y-4">
      <Link href={`/store/${slug}/admin/apps/procurement`} className="inline-flex text-xs font-medium text-primary hover:underline">
        ← Procurement &amp; Vendors
      </Link>
      {children}
    </div>
  );
}
