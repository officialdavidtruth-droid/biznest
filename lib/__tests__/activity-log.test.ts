import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), auth: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { storeActivityLog: { create: m.create } } }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/observability/log", () => ({ logError: m.logError, errorMeta: (e: unknown, x: object) => ({ ...x }) }));

vi.unmock("@/lib/activity-log");
import { logActivity, logStoreActivity } from "@/lib/activity-log";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-mgr", name: "Mo", email: "mo@x.com", role: "CUSTOMER" } });
  m.create.mockResolvedValue({});
});

describe("activity log", () => {
  it("attributes the action to the signed-in user, not the owner, with the store role", async () => {
    await logActivity({ storeId: "s1", action: "coupon.created", role: "MANAGER", target: "SAVE10" });
    expect(m.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storeId: "s1", actorUserId: "u-mgr", actorEmail: "mo@x.com", actorRole: "MANAGER", action: "coupon.created", target: "SAVE10" }),
    });
  });

  it("never throws when the write fails, and reports it to observability", async () => {
    m.create.mockRejectedValue(new Error("db down"));
    await expect(logStoreActivity({ storeId: "s1", actor: { role: "OWNER" }, action: "x" })).resolves.toBeUndefined();
    expect(m.logError).toHaveBeenCalled();
  });
});
