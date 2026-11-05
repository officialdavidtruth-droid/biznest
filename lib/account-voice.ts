import "server-only";
import { prisma } from "@/lib/prisma";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";

/** True when the store uses the hotel template, the only business the stay-focused account wording fits. */
export async function isHotelStore(slug: string): Promise<boolean> {
  const row = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  return row?.template?.name === HOTEL_TEMPLATE_NAME;
}

/** Help-centre questions on the account Support page. Hotel questions only make sense for a hotel. */
export function supportFaqs(isHotel: boolean): string[] {
  return isHotel
    ? ["How do I modify or cancel my booking?", "Is airport pickup available?", "What time is check-in and check-out?", "Do you offer early check-in or late check-out?", "How can I earn and use reward points?", "What payment methods are accepted?"]
    : ["How do I track my order or booking?", "How do I change or cancel an order or booking?", "What is your refund and returns policy?", "How can I earn and use reward points?", "What payment methods are accepted?", "How do I contact the team?"];
}
