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
  const images = service.images.length ? service.images : [];
  // Booking-only businesses (hotels, salons, studios, etc.) don't sell
  // cart-able products, so the cart icon should never show on their
  // service pages -- it was previously rendered unconditionally here,
  // which is why a pure-booking store still showed a shopping bag.
  const showCart = store.business?.sellsProducts ?? true;

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }} className="storefront-root sp-root">
      <style
        // Scoped, server-renderable responsive rules — no client JS needed.
        // sp-* classes are namespaced to this page only.
        dangerouslySetInnerHTML={{
          __html: `
            .sp-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 48px; align-items: start; }
            .sp-thumbs { display: flex; gap: 8px; margin-top: 10px; }
            .sp-thumb { flex-shrink: 0; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; cursor: pointer; }
            @media (max-width: 760px) {
              .sp-grid { grid-template-columns: 1fr; gap: 24px; }
              .sp-hero { aspect-ratio: 4/3 !important; }
            }
          `,
        }}
      />

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: `${bg}f2`,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${ink}14`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link
            href={`/${slug}`}
            style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none", minWidth: 0 }}
          >
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <span
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${accent}1f`, color: accent,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
                }}
              >
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{store.name}</span>
          </Link>
          {showCart && <CartLink storeSlug={slug} accent={accent} ink={ink} />}
        </div>
      </nav>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 28px 90px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 26, opacity: 0.55, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
          <span style={{ opacity: 0.5 }}>›</span>
          {service.category?.name && (
            <>
              <span>{service.category.name}</span>
              <span style={{ opacity: 0.5 }}>›</span>
            </>
          )}
          <span style={{ fontWeight: 600, opacity: 0.85 }}>{service.name}</span>
        </div>

        <div className="sp-grid">
          <div>
            <div
              className="sp-hero"
              style={{
                aspectRatio: "1/1",
                borderRadius: radius,
                overflow: "hidden",
                background: `${ink}0a`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 20px 50px ${ink}0f`,
                border: `1px solid ${ink}0f`,
              }}
            >
              {images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[0]} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 48, fontWeight: 800, opacity: 0.22 }}>{service.name.charAt(0)}</span>
              )}
            </div>

            {images.length > 1 && (
              <div className="sp-thumbs">
                {images.slice(0, 5).map((src, i) => (
                  <div key={src + i} className="sp-thumb" style={{ border: i === 0 ? `2px solid ${accent}` : `1px solid ${ink}1a` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${service.name} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {service.category?.name && (
              <div
                style={{
                  display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  color: accent, background: `${accent}14`, padding: "5px 11px", borderRadius: 999, marginBottom: 14,
                }}
              >
                {service.category.name}
              </div>
            )}

            <h1 style={{ fontSize: "clamp(24px,3.2vw,32px)", fontWeight: 800, lineHeight: 1.2, marginBottom: 14 }}>{service.name}</h1>

            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 27, fontWeight: 800 }}>
                {service.currency} {Number(service.price).toLocaleString()}
              </span>
              {service.durationMins && !service.totalUnits && (
                <span style={{ fontSize: 13, opacity: 0.55 }}>· {service.durationMins} min session</span>
              )}
              {service.totalUnits ? <span style={{ fontSize: 13, opacity: 0.55 }}>· per night</span> : null}
            </div>

            {service.description && (
              <>
                <div style={{ height: 1, background: `${ink}12`, marginBottom: 20 }} />
                <p style={{ fontSize: 14.5, lineHeight: 1.75, opacity: 0.78, marginBottom: 24, whiteSpace: "pre-wrap" }}>
                  {service.description}
                </p>
              </>
            )}

            {service.isBookable ? (
              <BookingWidget
                storeSlug={slug}
                serviceId={service.id}
                serviceName={service.name}
                servicePrice={Number(service.price)}
                currency={service.currency}
                durationMins={service.durationMins}
                totalUnits={service.totalUnits}
                accent={accent}
                ink={ink}
                bg={bg}
                radius={radius}
                startOpen
              />
            ) : (
              <div
                style={{
                  marginTop: 8, padding: 16, borderRadius: radius, border: `1px dashed ${ink}22`, fontSize: 13.5, opacity: 0.7,
                }}
              >
                Contact {store.name} to arrange this service.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
