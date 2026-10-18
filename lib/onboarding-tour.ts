import { buildNavGroups, filterNavGroupsForRole, type InstalledAppNav } from "@/lib/constants/dashboard-nav";

/**
 * Steps for the first-run "pointer" tour of the store dashboard.
 *
 * Built from the SAME nav the sidebar renders (buildNavGroups), so the tour
 * only ever points at things this particular business actually has: a
 * service-only store never gets told about Inventory, a restaurant gets its
 * menu wording, installed apps appear, and so on. Plain serialisable data so
 * it can be built on the server and handed to the client component.
 */

export type TourStep = {
  id: string;
  /** Matches [data-tour="…"] in the DOM. null = centred card, no pointer. */
  target: string | null;
  /** desktop: pointer on a sidebar item; mobile: condensed overview; both: always shown. */
  kind: "item" | "group" | "both";
  eyebrow?: string;
  title: string;
  body: string;
};

/** Short, practical description per dashboard area, keyed by nav href. */
const ITEM_COPY: Record<string, string> = {
  "": "Your home base: what's happening in the business today and what needs your attention. It adapts to the kind of business you run.",
  "/apps": "Add extra tools, like restaurant operations or hotel management, when your plan and business type allow it. Apps you install appear in this sidebar.",
  "/pos": "Ring up in-person sales at the counter so they sit alongside your online orders.",
  "/orders": "Every order from your store lands here. Update its status, see the customer's details and handle refunds.",
  "/products": "Add what you sell with photos, prices, stock and options. Categories, add-ons, variants and sections live in the dropdown under this item.",
  "/services": "List the services you offer and their prices so customers can book them online.",
  "/bookings": "Reservations and appointments that customers make on your website show up here.",
  "/calendar": "See your bookings laid out by day and week.",
  "/inventory": "Track stock levels, cost and profit across your catalog, and spot items running low.",
  "/customers": "Everyone who has bought from or booked with you, with their history in one place.",
  "/suppliers": "Keep your suppliers' details together.",
  "/purchase-orders": "Raise and track stock orders to your suppliers.",
  "/delivery": "Set the areas you deliver to and what delivery costs in each one.",
  "/staff": "Invite your team, set their login and choose exactly which areas each person can use.",
  "/payments": "See the payments you've received and manage how you get paid out.",
  "/invoices": "Create invoices, send them to customers and track which are paid.",
  "/quotes": "Quote requests from your website arrive here with the customer's full brief.",
  "/coupons": "Create discount codes customers can use at checkout.",
  "/abandoned-checkouts": "See shoppers who left before paying, so you can follow up.",
  "/reviews": "See what customers are saying about your business.",
  "/messages": "Conversations with customers who contact your store.",
  "/analytics": "Sales, customer and performance reports to show what's working.",
  "/templates": "Pick the design of your online store. You can switch whenever you like.",
  "/customize": "Edit your website visually: hero, story, colours and your own pages built from blocks.",
  "/menus": "Choose which links appear in your website's header menu.",
  "/hotel": "Manage the content of your hotel website.",
  "/events": "Publish events and offers for your website.",
  "/gallery": "Photos and videos shown on your website.",
  "/tastehouse": "Manage the content of your TasteHouse website.",
  "/fnb": "Restaurant operations tools for running your kitchen and service.",
  "/settings": "Your business name, logo, contact details and store options.",
  "/verification": "Check your verification status and finish any steps still needed, so customers can trust your store.",
  "/subscription": "Your plan, billing and upgrades.",
  "/activity": "A record of who did what in your dashboard.",
  "/support": "Stuck? Get help from the BizNest team.",
};

const GROUP_COPY: Record<string, string> = {
  Overview: "Your dashboard home shows what's happening today.",
  Apps: "Extra tools you can add to your workspace as your business grows.",
  Sell: "Everything you sell and how orders or bookings come in.",
  Manage: "Run the behind-the-scenes: customers, stock, suppliers, delivery and your team.",
  Money: "Get paid and keep your records straight with payments, invoices and quotes.",
  Grow: "Bring customers back and learn what's working: discounts, reviews, messages and reports.",
  Website: "Design your online store and the pages customers see.",
  Account: "Your business details, verification, plan and support.",
};

export function buildTourSteps(opts: {
  storeName: string;
  business: { sellsProducts: boolean; offersServices: boolean; category?: string | null; subscriptionName?: string | null; installedApps?: InstalledAppNav[] };
}): TourStep[] {
  const groups = filterNavGroupsForRole(buildNavGroups(opts.business), { canManageOwnerOnly: true });
  const steps: TourStep[] = [
    {
      id: "welcome",
      target: null,
      kind: "both",
      title: `Welcome to BizNest, ${opts.storeName}!`,
      body: "Let's take a quick look around so you know where everything is. It takes about two minutes, and you can leave any time.",
    },
  ];

  // Some hrefs appear twice in the nav (e.g. App Marketplace / Installed Apps);
  // point at each destination once.
  const seenHrefs = new Set<string>();

  for (const group of groups) {
    // Mobile gets one overview card per area instead of 25 pointers at a hidden sidebar.
    if (group.label !== "Overview") {
      steps.push({
        id: `group:${group.label}`,
        target: null,
        kind: "group",
        eyebrow: group.label,
        title: group.label,
        body: `${GROUP_COPY[group.label] ?? ""} Here: ${group.items.map((i) => i.label).join(", ")}.`.trim(),
      });
    }
    for (const item of group.items) {
      const key = item.href || "/";
      if (seenHrefs.has(key)) continue;
      seenHrefs.add(key);
      steps.push({
        id: `item:${group.label}:${item.href || "/"}:${item.label}`,
        target: `nav:${item.href || "/"}`,
        kind: "item",
        eyebrow: group.label,
        title: item.label,
        body: ITEM_COPY[item.href] ?? `${item.label} is a tool made for your type of business.`,
      });
    }
  }

  steps.push(
    {
      id: "mobile-menu",
      target: "mobile-menu",
      kind: "group",
      title: "Your menu",
      body: "Tap Menu any time to open everything: sales, customers, website, settings and more.",
    },
    {
      id: "view-store",
      target: "view-store",
      kind: "item",
      title: "See your live store",
      body: "This opens your public website in a new tab, exactly as customers see it. Check it after every change.",
    },
    {
      id: "notifications",
      target: "notifications",
      kind: "item",
      title: "Notifications",
      body: "New orders, bookings and messages show up here so you never miss one.",
    },
    {
      id: "finish",
      target: null,
      kind: "both",
      title: "You're ready to go",
      body: "A good first path: add your first product or service, pick a template, then complete Verification. Replay this tour any time with the Take the tour button at the top.",
    },
  );
  return steps;
}
