import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { getGeneralStoreConversation, listStoreDisputes } from "@/lib/actions/account";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraSupportPage } from "@/components/storefront/veloura-support-page";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = await requireStoreCustomer(slug);
  const store = await getStoreBranding(slug);
  if (!membership || !store) notFound();

  const template = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  if (template?.template?.name !== HOTEL_TEMPLATE_NAME) notFound();

  const [conversation, disputes, hotelContent, user] = await Promise.all([
    getGeneralStoreConversation(slug),
    listStoreDisputes(slug),
    getHotelContent(slug),
    prisma.user.findUnique({ where: { id: membership.userId }, select: { id: true, name: true, email: true, phone: true, image: true, createdAt: true } }),
  ]);

  const faqPage = await prisma.storePage.findUnique({ where: { storeId_slug: { storeId: membership.storeId, slug: "faq" } }, select: { content: true, isPublished: true } });
  const faqBody = faqPage?.isPublished ? ((faqPage.content as { body?: string } | null)?.body ?? null) : null;
  const heroImage = hotelContent.rooms.find((room) => room.featured)?.image || hotelContent.rooms[0]?.image || null;

  return <VelouraSupportPage slug={slug} store={store} user={user} heroImage={heroImage} conversation={conversation} disputes={disputes} faqBody={faqBody} />;
}
