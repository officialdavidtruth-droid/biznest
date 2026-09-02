import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, getSignatureTheme, isSignatureTemplate, type TemplateTheme } from "@/lib/template-themes";
import { BookingFlowWizard } from "@/components/storefront/templates/booking-flow-wizard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; roomId: string }> }): Promise<Metadata> {
  const { slug, roomId } = await params;
  const room = await prisma.service.findFirst({ where: { store: { slug }, isPublished: true, OR: [{ id: roomId }, { slug: roomId }] } });
  return room ? { title: `Book ${room.name} — ${slug}` } : { title: "Book" };
}

export default async function BookRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; roomId: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { slug, roomId } = await params;
  const query = await searchParams;

  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();

  const service = await prisma.service.findFirst({
    where: { storeId: rawStore.id, isPublished: true, isBookable: true, OR: [{ id: roomId }, { slug: roomId }] },
    include: { category: true },
  });
  if (!service) notFound();

  const signatureTheme = isSignatureTemplate(rawStore.template?.name) ? getSignatureTheme(rawStore.template?.name) : null;
  const theme: TemplateTheme = signatureTheme || resolveStoreTheme(rawStore.template?.category, rawStore.name, rawStore.themeColors as any, rawStore.fontFamily, rawStore.template?.name);

  const attributes = (service.attributes && typeof service.attributes === "object" ? service.attributes : {}) as Record<string, unknown>;
  const amenities = ["wifi", "view", "breakfast"]
    .map((key) => (attributes[key] ? String(attributes[key]) : null))
    .filter(Boolean) as string[];

  // Niche label: "Room" for hotels, generic "Unit" fallback for other
  // unit-based businesses (short-let apartments, rental fleets, venues…)
  // reusing this same booking flow.
  const itemLabelSingular = rawStore.businessType === "Hotel & Lodging" ? "Room" : "Unit";

  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <BookingFlowWizard
        slug={slug}
        theme={theme}
        serviceId={service.id}
        serviceName={service.name}
        serviceDescription={service.description}
        serviceImage={service.images[0] ?? null}
        price={Number(service.price)}
        currency={service.currency}
        guestCapacity={attributes.maxGuests ? String(attributes.maxGuests) : undefined}
        bedType={attributes.bedType ? String(attributes.bedType) : undefined}
        roomSize={attributes.roomSize ? String(attributes.roomSize) : undefined}
        itemLabelSingular={itemLabelSingular}
        amenities={amenities}
        defaultCheckIn={query.checkIn || ""}
        defaultCheckOut={query.checkOut || ""}
        defaultGuests={query.guests ? Number(query.guests) : 2}
        changeRoomHref={`/store/${slug}/hotel/rooms`}
      />
    </div>
  );
}
