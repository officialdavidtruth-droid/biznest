import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { CartLink } from "@/components/storefront/cart-link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; serviceId: string }> }): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const service = await prisma.service.findFirst({ where: { id: serviceId, store: { slug } } });
  if (!service) return {};
  return { title: `${service.name} — ${slug}`, description: service.description?.slice(0, 150) };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true },
  });
  if (!store || store.status !== "ACTIVE") notFound();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, storeId: store.id, isPublished: true },
    include: { category: true },
  });
  if (!service) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  // This template's own real palette/radius, not a Heenzy-only fallback.
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const { accent, ink, bg, radius } = theme;

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }} className="storefront-root">
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none" }}>{store.name}</Link>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>
          <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
          {" / "}
          {service.category?.name ? <>{service.category.name}{" / "}</> : null}
          <span>{service.name}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 40 }}>
          <div style={{ aspectRatio: "1/1", borderRadius: radius, overflow: "hidden", background: `${ink}0d`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {service.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={service.images[0]} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 40, opacity: 0.3 }}>{service.name.charAt(0)}</span>
            )}
          </div>

          <div>
            {service.category?.name && (
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
                {service.category.name}
              </div>
            )}
            <h1 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, marginBottom: 12 }}>{service.name}</h1>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{service.currency} {Number(service.price).toLocaleString()}</span>
              {service.durationMins && <span style={{ fontSize: 13, opacity: 0.6 }}>· {service.durationMins} min</span>}
            </div>
            {service.description && (
              <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.75, marginBottom: 24, whiteSpace: "pre-wrap" }}>{service.description}</p>
            )}

            {service.isBookable ? (
              <BookingWidget storeSlug={slug} serviceId={service.id} serviceName={service.name} servicePrice={Number(service.price)} accent={accent} ink={ink} bg={bg} radius={radius} startOpen />
            ) : (
              <p style={{ fontSize: 13.5, opacity: 0.65 }}>Contact {store.name} to arrange this service.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
            }
