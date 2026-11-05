import "server-only";
import { readFlight, publicFlight, flightClientLines } from "@/lib/travel-flight";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { getPluginEntitlement } from "@/lib/plugins";
import { TRAVEL_PLUGIN_KEY, depositFor, tripMoney, netReceived } from "@/lib/travel";
import { travelOnlinePaymentError } from "@/lib/payments/travel-charge";

/** 192 random bits, URL-safe. Knowing it is the only way into a proposal, so it is never derived from anything guessable. */
export const newShareToken = () => randomBytes(24).toString("base64url");
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const hashPartnerKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const DEFAULT_DEPOSIT_PERCENT = 30;

export const proposalUrl = (store: { slug: string; customDomain: string | null; customDomainStatus: string }, token: string) => buildStoreUrl(store, `/travel/p/${token}`);

export type ProposalPayOption = { id: "deposit" | "next" | "balance"; label: string; amount: number };

export type ProposalView = {
  token: string;
  store: { id: string; slug: string; name: string; logoUrl: string | null; primary: string | null; contactEmail: string | null; contactPhone: string | null };
  trip: {
    id: string; reference: string; title: string; destination: string; status: string; currency: string; clientFirstName: string;
    departDate: string | null; returnDate: string | null; note: string | null; validUntil: string | null; expired: boolean; closed: boolean;
    sentAt: string | null; terms: string | null; acceptedAt: string | null; acceptedName: string | null;
  };
  travellers: string[];
  items: { kind: string; description: string; startDate: string | null; endDate: string | null; status: string; sellPrice: number; /** Ready-to-print flight lines. Booking reference and tickets appear only after the client accepts. */ flightLines: string[] }[];
  days: { dayNumber: number; title: string; description: string | null }[];
  schedule: { id: string; amount: number; dueDate: string | null; status: "DUE" | "RECEIVED"; paidAt: string | null }[];
  money: { total: number; paid: number; balance: number };
  payOptions: ProposalPayOption[];
  onlineError: string | null;
};

/**
 * Everything the public proposal / "My trip" page shows. Built to be safe for anyone holding the link: it never
 * includes cost prices, margin, supplier names, agent commission, passport numbers, internal notes or other clients.
 * Returns null for an unknown/revoked token, a different store, an inactive store or a store without the Travel app.
 */
/** The ticketing deadline is internal and is never selected here. */
export function flightLinesFor(stored: unknown, accepted: boolean): string[] {
  const f = publicFlight(readFlight(stored), accepted);
  return f ? flightClientLines(f, accepted) : [];
}

export async function loadProposal(slug: string, token: string, now = new Date()): Promise<ProposalView | null> {
  if (!TOKEN_RE.test(token)) return null;
  const trip = await prisma.travelTrip.findUnique({
    where: { shareToken: token },
    include: {
      store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, status: true, customDomain: true, customDomainStatus: true } },
      client: { select: { fullName: true } },
      package: { select: { depositPercent: true } },
      travellers: { select: { fullName: true, isLead: true }, orderBy: [{ isLead: "desc" }, { fullName: "asc" }] },
      items: { where: { status: { not: "CANCELLED" } }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }], select: { kind: true, description: true, startDate: true, endDate: true, status: true, sellPrice: true, flightDetails: true } },
      itineraryDays: { orderBy: { dayNumber: "asc" } },
      payments: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!trip || trip.store.slug !== slug || trip.store.status !== "ACTIVE") return null;
  const ent = await getPluginEntitlement(trip.store.id, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return null;

  const m = tripMoney(trip, trip.payments);
  const closed = trip.status === "CANCELLED" || trip.status === "COMPLETED";
  const expired = !!trip.proposalValidUntil && trip.proposalValidUntil.getTime() < now.getTime() && !trip.acceptedAt;
  const onlineError = await travelOnlinePaymentError(trip.store.id, trip.currency);

  const payOptions: ProposalPayOption[] = [];
  if (!closed && !expired && trip.acceptedAt && !onlineError && m.balance > 0.004) {
    const pct = trip.package?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
    const depositTarget = depositFor(m.total, pct);
    const depositLeft = Math.round((depositTarget - m.paid) * 100) / 100;
    const nextDue = trip.payments.find((p) => p.status === "DUE" && Number(p.amount) > 0);
    if (depositLeft > 0.004 && depositLeft < m.balance - 0.004) payOptions.push({ id: "deposit", label: "Pay deposit", amount: Math.min(depositLeft, m.balance) });
    if (nextDue) payOptions.push({ id: "next", label: "Pay next instalment", amount: Math.min(Number(nextDue.amount), m.balance) });
    payOptions.push({ id: "balance", label: "Pay full balance", amount: m.balance });
  }

  const theme = (trip.store.themeColors ?? null) as { primary?: string } | null;
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return {
    token,
    store: { id: trip.store.id, slug: trip.store.slug, name: trip.store.name, logoUrl: trip.store.logoUrl, primary: /^#[0-9a-f]{6}$/i.test(theme?.primary ?? "") ? theme!.primary! : null, contactEmail: trip.store.contactEmail, contactPhone: trip.store.contactPhone },
    trip: {
      id: trip.id, reference: trip.reference, title: trip.title, destination: trip.destination, status: trip.status, currency: trip.currency,
      clientFirstName: trip.client.fullName.split(" ")[0] || "there", departDate: iso(trip.departDate), returnDate: iso(trip.returnDate),
      note: trip.proposalNote, validUntil: iso(trip.proposalValidUntil), expired, closed, sentAt: iso(trip.proposalSentAt), terms: trip.termsText,
      acceptedAt: iso(trip.acceptedAt), acceptedName: trip.acceptedName,
    },
    travellers: trip.travellers.map((t) => t.fullName),
    items: trip.items.map((i) => ({ kind: i.kind, description: i.description, startDate: iso(i.startDate), endDate: iso(i.endDate), status: i.status, sellPrice: Number(i.sellPrice), flightLines: i.kind === "FLIGHT" ? flightLinesFor(i.flightDetails, !!trip.acceptedAt) : [] })),
    days: trip.itineraryDays.map((d) => ({ dayNumber: d.dayNumber, title: d.title, description: d.description })),
    schedule: trip.payments.filter((p) => (p.status === "DUE" && Number(p.amount) > 0) || (p.status === "RECEIVED" && netReceived(p) > 0)).map((p) => ({ id: p.id, amount: p.status === "RECEIVED" ? netReceived(p) : Number(p.amount), dueDate: iso(p.dueDate), status: p.status as "DUE" | "RECEIVED", paidAt: iso(p.paidAt) })),
    money: { total: m.total, paid: m.paid, balance: m.balance },
    payOptions, onlineError,
  };
}
