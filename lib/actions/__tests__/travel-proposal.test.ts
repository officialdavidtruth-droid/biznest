import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rate: vi.fn(), load: vi.fn(), updateMany: vi.fn(), storeFind: vi.fn(), clientFind: vi.fn(), charge: vi.fn(), notify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { travelTrip: { updateMany: m.updateMany }, store: { findUnique: m.storeFind }, travelClient: { findFirst: m.clientFind } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate, getClientIp: () => "9.9.9.9" }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/payments/travel-charge", () => ({ startTravelCharge: m.charge }));
vi.mock("@/lib/travel-proposal", async () => ({ loadProposal: m.load, TOKEN_RE: /^[A-Za-z0-9_-]{20,64}$/ }));

import { acceptTravelProposal, payTravelProposal } from "@/lib/actions/travel-proposal";

const TOKEN = "abcdefghijklmnopqrstuvwx";
const view = (over: Record<string, unknown> = {}, trip: Record<string, unknown> = {}) => ({
  token: TOKEN, store: { id: "storeA", slug: "wander" },
  trip: { id: "trip1", title: "Dubai", reference: "TRV-1", status: "QUOTED", currency: "NGN", closed: false, expired: false, acceptedAt: null, ...trip },
  money: { total: 500000, paid: 0, balance: 500000 }, payOptions: [{ id: "deposit", label: "Pay deposit", amount: 150000 }, { id: "balance", label: "Pay full balance", amount: 500000 }], onlineError: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ allowed: true });
  m.load.mockResolvedValue(view());
  m.updateMany.mockResolvedValue({ count: 1 });
  m.storeFind.mockResolvedValue({ id: "storeA", slug: "wander", business: { userId: "owner1" } });
  m.clientFind.mockResolvedValue({ fullName: "Ada Obi", email: "ada@x.com" });
  m.charge.mockResolvedValue({ success: true, url: "https://pay.example/c" });
});

describe("acceptTravelProposal", () => {
  const good = { fullName: "Ada Obi", agree: true };

  it("records the typed name, time and address, and tells the agency", async () => {
    const r = await acceptTravelProposal("wander", TOKEN, good);
    expect(r.success).toBe(true);
    const call = m.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: "trip1", shareToken: TOKEN, acceptedAt: null });
    expect(call.data).toMatchObject({ acceptedName: "Ada Obi", acceptedIp: "9.9.9.9" });
    expect(call.data.acceptedAt).toBeInstanceOf(Date);
    expect(m.notify).toHaveBeenCalledTimes(1);
  });

  it("moves an enquiry to quoted when accepted", async () => {
    m.load.mockResolvedValue(view({}, { status: "ENQUIRY" }));
    await acceptTravelProposal("wander", TOKEN, good);
    expect(m.updateMany.mock.calls[0][0].data.status).toBe("QUOTED");
  });

  it("is idempotent: accepting twice changes nothing", async () => {
    m.load.mockResolvedValue(view({}, { acceptedAt: "2027-01-01T00:00:00.000Z" }));
    const r = await acceptTravelProposal("wander", TOKEN, good);
    expect(r).toEqual({ success: true, data: { acceptedAt: "2027-01-01T00:00:00.000Z" } });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("refuses bad tokens, unknown links, closed, expired and unpriced proposals", async () => {
    expect((await acceptTravelProposal("wander", "short", good)).success).toBe(false);
    m.load.mockResolvedValue(null);
    expect((await acceptTravelProposal("wander", TOKEN, good)).success).toBe(false);
    m.load.mockResolvedValue(view({}, { closed: true })); expect((await acceptTravelProposal("wander", TOKEN, good)).success).toBe(false);
    m.load.mockResolvedValue(view({}, { expired: true })); expect((await acceptTravelProposal("wander", TOKEN, good)).success).toBe(false);
    m.load.mockResolvedValue(view({ money: { total: 0, paid: 0, balance: 0 } })); expect((await acceptTravelProposal("wander", TOKEN, good)).success).toBe(false);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("needs a full name and the tick box", async () => {
    expect((await acceptTravelProposal("wander", TOKEN, { fullName: "Ada", agree: true })).success).toBe(false);
    expect((await acceptTravelProposal("wander", TOKEN, { fullName: "Ada Obi", agree: false })).success).toBe(false);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("is rate limited, and loses gracefully to a concurrent acceptance", async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await acceptTravelProposal("wander", TOKEN, good)).success).toBe(false);
    expect(m.load).not.toHaveBeenCalled();
    m.rate.mockResolvedValue({ allowed: true });
    m.updateMany.mockResolvedValue({ count: 0 });
    m.load.mockResolvedValueOnce(view()).mockResolvedValueOnce(view({}, { acceptedAt: "2027-01-02T00:00:00.000Z" }));
    expect(await acceptTravelProposal("wander", TOKEN, good)).toEqual({ success: true, data: { acceptedAt: "2027-01-02T00:00:00.000Z" } });
  });
});

describe("payTravelProposal", () => {
  const accepted = (over: Record<string, unknown> = {}) => view(over, { acceptedAt: "2027-01-01T00:00:00.000Z" });

  it("charges the amount the server computed, never one from the browser", async () => {
    m.load.mockResolvedValue(accepted());
    const r = await payTravelProposal("wander", TOKEN, "deposit");
    expect(r).toEqual({ success: true, data: { url: "https://pay.example/c" } });
    expect(m.charge.mock.calls[0][0]).toMatchObject({ tripId: "trip1", amountNaira: 150000, currency: "NGN", customerName: "Ada Obi" });
  });

  it("needs prior acceptance and an option that is actually offered", async () => {
    m.load.mockResolvedValue(view());
    expect((await payTravelProposal("wander", TOKEN, "deposit")).success).toBe(false);
    m.load.mockResolvedValue(accepted());
    expect((await payTravelProposal("wander", TOKEN, "next")).success).toBe(false);
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("passes along gateway problems and online-payment limits", async () => {
    m.load.mockResolvedValue(accepted({ onlineError: "Online payment isn't available for USD." }));
    expect(await payTravelProposal("wander", TOKEN, "deposit")).toEqual({ success: false, error: "Online payment isn't available for USD." });
    m.load.mockResolvedValue(accepted());
    m.charge.mockResolvedValue({ success: false, error: "Gateway down." });
    expect(await payTravelProposal("wander", TOKEN, "balance")).toEqual({ success: false, error: "Gateway down." });
  });
});
