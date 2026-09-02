import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, getSignatureTheme, isSignatureTemplate, type TemplateTheme } from "@/lib/template-themes";
import { RoomDetail } from "@/components/storefront/templates/room-detail";
import { getUnitBookingNiche } from "@/lib/storefront/unit-booking-niche";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; roomId: string }> }): Promise<Metadata> {
  const { slug, roomId } = await params;
  const room = await prisma.service.findFirst({ where: { store: { slug }, isPublished: true, OR: [{ id: roomId }, { slug: roomId }] } });
  return room ? { title: `${room.name} — ${slug}`, description: room.description?.slice(0, 150) } : { title: "Room Details" };
}

export default async function HotelRoomPage({ params }: { params: Promise<{ slug: string; roomId: string }> }) {
  const { slug, roomId } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();

  const room = await prisma.service.findFirst({
    where: { storeId: rawStore.id, isPublished: true, OR: [{ id: roomId }, { slug: roomId }] },
    include: { category: true, reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true, image: true } } } } },
  });
  if (!room) notFound();

  const signatureTheme = isSignatureTemplate(rawStore.template?.name) ? getSignatureTheme(rawStore.template?.name) : null;
  const theme: TemplateTheme = signatureTheme || resolveStoreTheme(rawStore.template?.category, rawStore.name, rawStore.themeColors as any, rawStore.fontFamily, rawStore.template?.name);
  const isHotel = rawStore.businessType === "Hotel & Lodging" || Boolean(signatureTheme && ["hotel", "maison", "great-treasure", "grand-vere"].includes(signatureTheme.signatureMode));
  const isRoom = /room|suite|studio|apartment|villa|penthouse|chalet|cottage|lodge|duplex/i.test(`${room.name} ${room.category?.name ?? ""}`);
  if (!isHotel || !isRoom) notFound();

  const niche = getUnitBookingNiche(rawStore.businessType, rawStore.storefrontConfig);
  const attrs = (room.attributes && typeof room.attributes === "object" && !Array.isArray(room.attributes) ? room.attributes : {}) as Record<string, unknown>;
  const address = [rawStore.business?.city, rawStore.business?.state, rawStore.business?.country].filter(Boolean).join(", ");

  const quickFacts = [
    attrs.maxGuests ? { icon: "guests" as const, label: `${attrs.maxGuests} Guests` } : null,
    attrs.bedType ? { icon: "bed" as const, label: String(attrs.bedType) } : null,
    attrs.roomSize ? { icon: "size" as const, label: `${attrs.roomSize} m²` } : null,
    attrs.view ? { icon: "view" as const, label: String(attrs.view) } : null,
  ].filter(Boolean) as { icon: "guests" | "bed" | "size" | "view"; label: string }[];

  const amenityStrip = niche.amenityFacets.filter((f) => attrs[f.key]).slice(0, 6);

  const featureGrid = [
    attrs.bedType ? { label: `${attrs.bedType}`, value: "" } : null,
    { label: "Work Desk", value: "" },
    attrs.roomSize ? { label: `${attrs.roomSize} m² Room Size`, value: "" } : null,
    { label: "Mini Bar", value: "" },
    { label: "Smart TV (Netflix, YouTube)", value: "" },
    { label: "In-room Safe", value: "" },
    attrs.view ? { label: `${attrs.view}`, value: "" } : null,
    { label: "En-suite Bathroom", value: "" },
    { label: "Complimentary Toiletries", value: "" },
    { label: "Daily Housekeeping", value: "" },
    { label: "24/7 Room Service", value: "" },
    { label: "Non-Smoking", value: "" },
  ].filter(Boolean) as { label: string; value: string }[];

  const reviews = room.reviews.map((r) => ({
    id: r.id,
    name: r.author?.name || "Guest",
    avatarUrl: r.author?.image || null,
    date: r.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    rating: r.rating,
    text: r.comment || "",
  }));
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <RoomDetail
      slug={slug}
      theme={theme}
      store={{ name: rawStore.name, logoUrl: rawStore.logoUrl, contactPhone: rawStore.contactPhone, contactEmail: rawStore.contactEmail, address }}
      roomId={room.id}
      name={room.name}
      description={room.description}
      price={Number(room.price)}
      currency={room.currency}
      images={room.images}
      badge={quickFacts.length ? "Most Popular" : null}
      breadcrumbLabel={niche.itemLabelPlural}
      quickFacts={quickFacts}
      heroQuote={niche.heroQuote}
      amenityStrip={amenityStrip}
      featureGrid={featureGrid}
      overviewParagraphs={[
        room.description || `Our ${room.name} offers a sophisticated and spacious retreat, designed for both business and leisure travelers.`,
        `Enjoy premium amenities, high-speed WiFi, and a thoughtfully curated space designed to give you a superior ${niche.itemLabelSingular.toLowerCase()} experience.`,
      ]}
      policies={null}
      reviews={reviews}
      avgRating={avgRating}
      reviewCount={reviews.length}
      rateUnit={niche.rateUnit}
      itemLabelSingular={niche.itemLabelSingular}
      itemLabelPlural={niche.itemLabelPlural}
      guarantees={niche.guarantees}
      addonsPromo={niche.addons.length ? {
        title: "Make Your Stay Even Better",
        body: `Add ${niche.addons.slice(0, 2).map((a) => a.label.toLowerCase()).join(", ")} or more to your booking.`,
        ctaLabel: "Explore Add-ons",
        ctaHref: `/store/${slug}/room/${room.id}/book`,
        image: room.images[1] || null,
      } : null}
      bookBasePath={`/store/${slug}/room/${room.id}/book`}
      isBookable={room.isBookable}
    />
  );
}
