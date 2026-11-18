import { describe, it, expect, vi, beforeEach } from "vitest";

// A small in-memory stand-in for the database so the real route handlers and attendance service run end to end.
const db = vi.hoisted(() => ({
  devices: [] as any[], employees: [] as any[], punches: [] as any[], attendance: [] as any[],
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    store: { findUnique: async () => ({ timezone: "Africa/Lagos" }) },
    hrSettings: { findUnique: async () => null },
    hrBiometricDevice: {
      findUnique: async ({ where }: any) => db.devices.find((d) => d.serialNumber === where.serialNumber) ?? null,
      update: async ({ where, data }: any) => Object.assign(db.devices.find((d) => d.id === where.id), data),
    },
    hrEmployee: {
      findMany: async ({ where }: any) => db.employees.filter((e) => e.storeId === where.storeId && where.deviceUserId.in.includes(e.deviceUserId)),
    },
    hrPunch: {
      createMany: async ({ data }: any) => {
        let count = 0;
        for (const r of data) {
          const dup = r.deviceUserId && db.punches.some((p) => p.storeId === r.storeId && p.deviceUserId === r.deviceUserId && +p.punchedAt === +r.punchedAt);
          if (!dup) { db.punches.push({ ...r }); count++; }
        }
        return { count };
      },
      findMany: async ({ where }: any) => db.punches.filter((p) => p.storeId === where.storeId && p.employeeId === where.employeeId && p.punchedAt >= where.punchedAt.gte && p.punchedAt < where.punchedAt.lt),
    },
    hrAttendance: {
      findUnique: async ({ where }: any) => db.attendance.find((a) => a.employeeId === where.employeeId_workDate.employeeId && +a.workDate === +where.employeeId_workDate.workDate) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const w = where.employeeId_workDate;
        const row = db.attendance.find((a) => a.employeeId === w.employeeId && +a.workDate === +w.workDate);
        if (row) Object.assign(row, update); else db.attendance.push({ ...create });
      },
    },
  };
  return { prisma };
});

import { GET, POST } from "@/app/iclock/cdata/route";
import { POST as punchApi } from "@/app/api/hr/punch/route";
import { hashDeviceKey } from "@/lib/hr/attendance-service";

const base = "http://x/iclock/cdata";

beforeEach(() => {
  // Scans dated in the future are rejected, so pin "now" to the evening of the test day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T20:00:00Z"));
  db.devices = [{ id: "d1", storeId: "s1", name: "Front", serialNumber: "SN1", apiKeyHash: hashDeviceKey("hrk_abc"), tzOffsetMinutes: 60 }];
  db.employees = [{ id: "e1", storeId: "s1", deviceUserId: "12", status: "ACTIVE" }];
  db.punches = []; db.attendance = [];
});

describe("ZKTeco push endpoint", () => {
  it("answers the handshake for a registered scanner and refuses unknown ones", async () => {
    const ok = await GET(new Request(`${base}?SN=SN1&options=all`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("GET OPTION FROM: SN1");
    expect((await GET(new Request(`${base}?SN=NOPE`))).status).toBe(403);
    expect(db.devices[0].lastSeenAt).toBeInstanceOf(Date);
  });

  it("turns a morning and an evening scan into check-in, check-out and an on-time status", async () => {
    const body = "12\t2026-11-18 08:45:10\t0\t1\t0\n12\t2026-11-18 17:31:00\t1\t1\t0\n";
    const res = await POST(new Request(`${base}?SN=SN1&table=ATTLOG`, { method: "POST", body }));
    expect(await res.text()).toBe("OK:2");
    expect(db.attendance).toHaveLength(1);
    const a = db.attendance[0];
    expect(a.checkIn.toISOString()).toBe("2026-11-18T07:45:10.000Z"); // 08:45 Lagos
    expect(a.checkOut.toISOString()).toBe("2026-11-18T16:31:00.000Z");
    expect(a.status).toBe("PRESENT");
    expect(a.checkInSource).toBe("DEVICE");
  });

  it("marks late arrivals, and resending the same scans changes nothing", async () => {
    const body = "12\t2026-11-18 09:40:00\t0\t1\n";
    await POST(new Request(`${base}?SN=SN1&table=ATTLOG`, { method: "POST", body }));
    await POST(new Request(`${base}?SN=SN1&table=ATTLOG`, { method: "POST", body }));
    expect(db.punches).toHaveLength(1);
    expect(db.attendance).toHaveLength(1);
    expect(db.attendance[0].status).toBe("LATE");
    expect(db.attendance[0].checkOut).toBeNull();
  });

  it("keeps scans from unmapped IDs without inventing attendance", async () => {
    await POST(new Request(`${base}?SN=SN1&table=ATTLOG`, { method: "POST", body: "99\t2026-11-18 08:00:00\t0\t1\n" }));
    expect(db.punches).toHaveLength(1);
    expect(db.punches[0].employeeId).toBeNull();
    expect(db.attendance).toHaveLength(0);
  });

  it("acknowledges other tables without storing them", async () => {
    const res = await POST(new Request(`${base}?SN=SN1&table=OPERLOG`, { method: "POST", body: "USER PIN=12\tName=Ada" }));
    expect(await res.text()).toBe("OK");
    expect(db.punches).toHaveLength(0);
  });
});

describe("generic punch API", () => {
  const call = (key: string | null, json: unknown) =>
    punchApi(new Request("http://x/api/hr/punch", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(json) }));

  it("rejects a wrong key", async () => {
    expect((await call("hrk_wrong", { serial: "SN1", punches: [{ userId: "12", time: "2026-11-18 08:00:00" }] })).status).toBe(401);
    expect((await call(null, { serial: "SN1", punches: [{ userId: "12", time: "2026-11-18 08:00:00" }] })).status).toBe(401);
  });
  it("accepts scans with the right key", async () => {
    const res = await call("hrk_abc", { serial: "SN1", punches: [{ userId: "12", time: "2026-11-18 08:00:00" }] });
    expect(res.status).toBe(200);
    expect(db.attendance[0].status).toBe("PRESENT");
  });
  it("rejects malformed bodies", async () => {
    expect((await call("hrk_abc", { serial: "SN1" })).status).toBe(400);
  });
});
