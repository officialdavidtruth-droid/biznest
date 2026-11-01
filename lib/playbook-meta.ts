import type { CanonicalBusinessType } from "@/lib/business-identity";

/**
 * Light-weight playbook identity (safe to import in client components).
 * The full chapter content lives in lib/playbooks.ts and is only loaded by
 * the /admin/playbook page.
 */
export type PlaybookKey = "food" | "retail" | "beauty" | "stay" | "services" | "creative" | "property" | "community" | "general";

export const PLAYBOOK_FOR_TYPE: Record<CanonicalBusinessType, PlaybookKey> = {
  Restaurant: "food", "Food & Groceries": "food",
  Fashion: "retail", Electronics: "retail", Retail: "retail", "Home & Furniture": "retail", Agriculture: "retail", Automotive: "retail",
  Beauty: "beauty", Salon: "beauty", Health: "beauty", "Health & Fitness": "beauty",
  "Hotel & Lodging": "stay", "Travel & Tourism": "stay",
  "Professional Services": "services", Agency: "services", Cleaning: "services", Construction: "services", "Software Development": "services", Logistics: "services",
  Photography: "creative", "Event Planning": "creative",
  "Real Estate": "property",
  Church: "community",
  Other: "general",
};

/** Sidebar / drawer card copy per niche. */
export const PLAYBOOK_CARD: Record<PlaybookKey, { title: string; sub: string }> = {
  food: { title: "Hot Orders Playbook", sub: "Your first 10 food orders" },
  retail: { title: "Sell-Out Playbook", sub: "From first sale to sold out" },
  beauty: { title: "Fully Booked Playbook", sub: "Fill your diary with clients" },
  stay: { title: "Full House Playbook", sub: "Win your first bookings" },
  services: { title: "Win Clients Playbook", sub: "Land your first paying client" },
  creative: { title: "Book Me Playbook", sub: "Turn followers into bookings" },
  property: { title: "Close the Deal Playbook", sub: "Your first serious enquiries" },
  community: { title: "Grow Together Playbook", sub: "Events, giving and reach" },
  general: { title: "First Sales Playbook", sub: "Make your first sale on BizNest" },
};

export function playbookKeyFor(type: CanonicalBusinessType): PlaybookKey {
  return PLAYBOOK_FOR_TYPE[type] ?? "general";
}
