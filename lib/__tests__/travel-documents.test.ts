import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildItinerary, buildTravelDocumentPdf, type TravelDocInput } from "@/lib/travel-documents";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const base = (over: Partial<TravelDocInput> = {}): TravelDocInput => ({
  kind: "quote",
  store: { name: "Wanderly Travel", contactPhone: "+234 800 000 0000", contactEmail: "hello@wanderly.test" },
  trip: { reference: "TRV-2611-ABCD", title: "Dubai family holiday", destination: "Dubai", departDate: d("2026-12-20"), returnDate: d("2026-12-27"), currency: "NGN", totalPrice: 1_500_000 },
  client: { fullName: "Adaeze Okafor", email: "ada@example.com", phone: "08012345678" },
  travellers: [{ fullName: "Adaeze Okafor", isLead: true }, { fullName: "Chidi Okafor" }],
  items: [
    { kind: "FLIGHT", description: "Lagos to Dubai return", startDate: d("2026-12-20"), endDate: d("2026-12-27"), status: "CONFIRMED", sellPrice: 900_000, confirmationRef: "XY12Z" },
    { kind: "HOTEL", description: "Marina hotel, 7 nights", startDate: d("2026-12-21"), status: "PENDING", sellPrice: 600_000 },
  ],
  payments: [{ amount: 500_000, status: "RECEIVED", method: "TRANSFER", paidAt: d("2026-11-01") }, { amount: 400_000, status: "DUE", method: "TRANSFER", dueDate: d("2026-12-01") }],
  now: d("2026-11-02"),
  ...over,
});

async function pageCount(bytes: Uint8Array) { return (await PDFDocument.load(bytes)).getPageCount(); }

describe("buildItinerary", () => {
  it("groups lines by start day, numbers days from departure and keeps undated lines apart", () => {
    const r = buildItinerary([
      { startDate: d("2026-12-21"), n: "b" }, { startDate: d("2026-12-20"), n: "a" }, { startDate: d("2026-12-20"), n: "a2" }, { startDate: null, n: "x" },
    ], d("2026-12-20"));
    expect(r.days.map((x) => [x.dayNumber, x.items.length])).toEqual([[1, 2], [2, 1]]);
    expect(r.undated).toHaveLength(1);
  });
});

const flight = { airline: "Emirates", flightNumber: "EK783", origin: "LOS", destination: "DXB", departAt: "2026-12-20T08:30", arriveAt: "2026-12-20T19:45", pnr: "X7K2PQ", cabin: "Economy", baggage: "2 x 23kg", tickets: [{ name: "Adaeze Okafor", number: "176-1234567890" }, { name: "Chidi Okafor", number: "176-1234567891" }] };
const withFlight = (kind: TravelDocInput["kind"]) => { const b = base({ kind }); return { ...b, items: [{ ...b.items[0], flight }, b.items[1]] }; };

describe("flight details in documents", () => {
  it.each(["quote", "invoice", "itinerary"] as const)("renders a %s with flight lines without error", async (kind) => {
    const bytes = await buildTravelDocumentPdf(withFlight(kind));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
  it("copes with a flight with no details beyond the airline", async () => {
    const b = base({ kind: "itinerary" });
    const bytes = await buildTravelDocumentPdf({ ...b, items: [{ ...b.items[0], flight: { ...flight, tickets: [], pnr: "", baggage: "", cabin: "", departAt: "", arriveAt: "" } }] });
    expect(await pageCount(bytes)).toBe(1);
  });
});

describe("buildTravelDocumentPdf", () => {
  it.each(["quote", "invoice", "itinerary"] as const)("renders a valid %s PDF", async (kind) => {
    const bytes = await buildTravelDocumentPdf(base({ kind }));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(await pageCount(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("does not crash on characters Helvetica can't draw", async () => {
    const bytes = await buildTravelDocumentPdf(base({
      client: { fullName: "Ọláwálé Adéyẹmí ✈️" },
      items: [{ kind: "TOUR", description: "Ẹ káàbọ̀ city tour 🌍 " + "very long word ".repeat(3) + "x".repeat(200), status: "PENDING", sellPrice: 1000, startDate: d("2026-12-22") }],
    }));
    expect(await pageCount(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("works with no service lines, no dates and no travellers", async () => {
    const bytes = await buildTravelDocumentPdf(base({ items: [], travellers: [], payments: [], trip: { ...base().trip, departDate: null, returnDate: null } }));
    expect(await pageCount(bytes)).toBe(1);
  });

  it("paginates a long trip and ignores cancelled lines", async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ kind: "TOUR", description: `Excursion number ${i + 1}`, status: i === 0 ? "CANCELLED" : "PENDING", sellPrice: 1000, startDate: d("2026-12-20") }));
    const bytes = await buildTravelDocumentPdf(base({ kind: "invoice", items }));
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });
});

describe("receipt and builder itinerary", () => {
  const rp = { number: "RCT-ABC123", amount: 500_000, method: "TRANSFER", paidAt: d("2026-11-01"), reference: "TRF-1" };
  it("renders a one-page receipt, with and without a refund", async () => {
    const a = await buildTravelDocumentPdf(base({ kind: "receipt", receiptPayment: rp }));
    expect(Buffer.from(a.slice(0, 5)).toString()).toBe("%PDF-");
    expect(await pageCount(a)).toBe(1);
    const b = await buildTravelDocumentPdf(base({ kind: "receipt", receiptPayment: { ...rp, refundedAmount: 100_000 } }));
    expect(await pageCount(b)).toBe(1);
  });
  it("renders an itinerary from hand-written days and merges dated lines by date", async () => {
    const bytes = await buildTravelDocumentPdf(base({
      kind: "itinerary",
      itineraryDays: [{ dayNumber: 2, title: "City tour", description: "Pickup 8am.\nLunch included." }, { dayNumber: 1, title: "Arrival", description: null }],
    }));
    expect(await pageCount(bytes)).toBeGreaterThanOrEqual(1);
  });
  it("paginates a long builder itinerary", async () => {
    const itineraryDays = Array.from({ length: 40 }, (_, i) => ({ dayNumber: i + 1, title: `Day ${i + 1} programme`, description: "Breakfast at the hotel. ".repeat(12) }));
    expect(await pageCount(await buildTravelDocumentPdf(base({ kind: "itinerary", itineraryDays })))).toBeGreaterThan(1);
  });
});
