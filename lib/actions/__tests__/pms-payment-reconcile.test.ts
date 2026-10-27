import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reservationFind: vi.fn(),
  reservationUpdateMany: vi.fn(),
  paymentCount: vi.fn(),
  paymentUpdateMany: vi.fn(),
  paymentFind: vi.fn(),
}));

vi.mock("@prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    propertyReservation: { findUnique: m.reservationFind, updateMany: m.reservationUpdateMany },
    payment: { count: m.paymentCount, updateMany: m.paymentUpdateMany, findUnique: m.paymentFind },
  },
}));

import { markPaymentFailed, reconcileReservationPaymentState } from "@/lib/payments/pending";

beforeEach(() => vi.clearAllMocks());

describe("reconcileReservationPaymentState", () => {
  it("releases a reservation stuck on PENDING when no payment is actually pending", async () => {
    m.reservationFind.mockResolvedValue({ paymentStatus: "PENDING" });
    m.paymentCount.mockResolvedValue(0);
    expect(await reconcileReservationPaymentState("r1")).toBe("UNPAID");
    expect(m.reservationUpdateMany).toHaveBeenCalledWith({ where: { id: "r1", paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } });
  });

  it("leaves a reservation alone while a payment really is pending", async () => {
    m.reservationFind.mockResolvedValue({ paymentStatus: "PENDING" });
    m.paymentCount.mockResolvedValue(1);
    expect(await reconcileReservationPaymentState("r1")).toBe("PENDING");
    expect(m.reservationUpdateMany).not.toHaveBeenCalled();
  });

  it("never touches PAID or REFUNDED reservations", async () => {
    m.reservationFind.mockResolvedValue({ paymentStatus: "PAID" });
    expect(await reconcileReservationPaymentState("r1")).toBe("PAID");
    expect(m.reservationUpdateMany).not.toHaveBeenCalled();
  });
});

describe("markPaymentFailed", () => {
  it("frees the reservation when its deposit attempt fails", async () => {
    m.paymentUpdateMany.mockResolvedValue({ count: 1 });
    m.paymentFind.mockResolvedValue({ reservationId: "r1" });
    m.reservationFind.mockResolvedValue({ paymentStatus: "PENDING" });
    m.paymentCount.mockResolvedValue(0);
    await markPaymentFailed("RES-r1-abc");
    expect(m.reservationUpdateMany).toHaveBeenCalled();
  });

  it("does nothing extra for a payment that was not pending", async () => {
    m.paymentUpdateMany.mockResolvedValue({ count: 0 });
    await markPaymentFailed("RES-r1-abc");
    expect(m.paymentFind).not.toHaveBeenCalled();
  });
});
