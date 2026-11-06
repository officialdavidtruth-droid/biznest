// Route: /store/[slug]/give
// Public giving page: anyone can give to a fund without an account. The amount is validated again on the server.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { GiveForm } from "@/components/storefront/member-portal-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  return { title: store ? `Give to ${store.name}` : "Give" };
}

export default async function GivePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug } = await params;
  const { payment: paymentFlag } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const funds = await prisma.memberPlan.findMany({ where: { storeId: store.id, kind: "FUND", active: true }, orderBy: { name: "asc" }, select: { name: true } });
  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 480 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">Give</h1>
        {paymentFlag === "success" && <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Thank you! Your gift was received. If you gave an email, your receipt is on its way.</p>}
        {paymentFlag === "failed" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>}
        <section className="mt-6 rounded-2xl p-6" style={card}>
          <GiveForm slug={slug} funds={["General", ...funds.map((f) => f.name)]} colors={colors} />
        </section>
      </main>
    </div>
  );
}
