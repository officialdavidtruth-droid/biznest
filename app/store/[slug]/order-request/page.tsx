// Route: /store/[slug]/order-request
// The customer-facing order form for made-to-measure work. No sign-in. Submitting it creates a request the tailor
// reviews in the Fashion workspace (nothing is charged, no job exists yet).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { TailoringOrderForm } from "@/components/storefront/tailoring-order-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  return { title: store ? `Order a custom outfit · ${store.name}` : "Order a custom outfit" };
}

export default async function TailoringOrderRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const palette = resolveStorePalette(store);
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 640 }} className="mx-auto px-6 py-12">
        <Link href={`/store/${slug}`} className="text-sm font-semibold no-underline" style={{ opacity: 0.7, color: "inherit" }}>← {store.name}</Link>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-4 text-3xl font-extrabold">Order a custom outfit</h1>
        <p className="mt-2 mb-8 text-sm" style={{ opacity: 0.75 }}>Tell {store.name} what you need. We&rsquo;ll contact you to take measurements and agree a price and delivery date.</p>
        <div className="rounded-2xl p-6" style={{ background: palette.card, border: `1px solid ${palette.ink}14` }}>
          <TailoringOrderForm slug={slug} storeName={store.name} colors={{ accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink }} />
        </div>
      </main>
    </div>
  );
}
