import { notFound, redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getQrCodesData } from "@/lib/actions/qr-codes";
import { QrCodeWorkspace } from "@/components/dashboard/qr-code-workspace";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function QrCodesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/apps/qr-codes`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "qr-codes");
  if (!entitlement.allowed || !entitlement.installed) {
    return <PluginInstallGate slug={slug} title="QR Codes" message={entitlement.reason} icon={QrCode} />;
  }
  const data = await getQrCodesData(slug);
  if ("error" in data) return <PluginInstallGate slug={slug} title="QR Codes" message={data.error} icon={QrCode} />;
  return <QrCodeWorkspace data={data} />;
}
