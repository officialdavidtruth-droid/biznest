import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, getSignatureTheme, isSignatureTemplate, type TemplateTheme } from "@/lib/template-themes";
import { HotelRoomDetail } from "@/components/storefront/hotel-room-detail";

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
    include: { category: true, reviews: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!room) notFound();

  const signatureTheme = isSignatureTemplate(rawStore.template?.name) ? getSignatureTheme(rawStore.template?.name) : null;
  const theme: TemplateTheme = signatureTheme || resolveStoreTheme(rawStore.template?.category, rawStore.name, rawStore.themeColors as any, rawStore.fontFamily, rawStore.template?.name);
  const isHotel = rawStore.businessType === "Hotel & Lodging" || Boolean(signatureTheme && ["hotel", "maison", "great-treasure", "grand-vere"].includes(signatureTheme.signatureMode));
  const isRoom = /room|suite|studio|apartment|villa|penthouse|chalet|cottage|lodge|duplex/i.test(`${room.name} ${room.category?.name ?? ""}`);
  if (!isHotel || !isRoom) notFound();

  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  return <HotelRoomDetail store={store} slug={slug} service={room} theme={theme} hotelMode={signatureTheme?.signatureMode} />;
}
