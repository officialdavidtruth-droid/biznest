/** Pure data (no database access) so it can be shared and tested. See lib/dashboard-sales.ts. */
/**
 * Money that comes in through plugins (invoices, bookings, hotel stays, travel, tailoring, rent,
 * memberships, tickets, jobs) is saved as a successful Payment, not as an Order. The dashboard
 * used to read only Orders, so a hotel, a landlord or a tailor saw ₦0 while money was arriving.
 * This is the one place that lists those payments so the dashboard, charts and activity feed agree.
 *
 * Left out on purpose: ORDER (already counted through Orders, so adding it would double count),
 * WALLET_FUNDING (a top-up, not a sale), and platform charges (subscription, plugin purchase, ads).
 */
export const PLUGIN_SALE_PURPOSES = [
  "INVOICE", "QUOTE_DEPOSIT", "SERVICE_BOOKING", "PMS_RESERVATION", "TRAVEL_BOOKING",
  "TAILORING_BALANCE", "RENT_PAYMENT", "MEMBER_PAYMENT", "TICKET_PURCHASE", "JOB_PAYMENT",
] as const;

export type PluginSalePurpose = (typeof PLUGIN_SALE_PURPOSES)[number];

export const PLUGIN_SALE_LABEL: Record<PluginSalePurpose, string> = {
  INVOICE: "Invoice", QUOTE_DEPOSIT: "Quote deposit", SERVICE_BOOKING: "Booking", PMS_RESERVATION: "Reservation",
  TRAVEL_BOOKING: "Trip", TAILORING_BALANCE: "Tailoring", RENT_PAYMENT: "Rent", MEMBER_PAYMENT: "Membership",
  TICKET_PURCHASE: "Tickets", JOB_PAYMENT: "Job",
};

export type PluginSale = { id: string; amount: number; at: Date; purpose: PluginSalePurpose; reference: string };
