import { describe, expect, it } from "vitest";
import { enqueueSale, listQueue, removeQueuedSale, syncQueue, type QueuedSale } from "@/lib/pos-offline";

const sale = (key: string): QueuedSale => ({
  key,
  input: { items: [{ productId: "ckx0000000000000000000000", quantity: 1 }], tenderType: "Cash" },
  total: 100,
  currency: "NGN",
  createdAt: 1,
});

describe("pos offline queue", () => {
  it("queues once per key", () => {
    enqueueSale("t1", sale("a"));
    enqueueSale("t1", sale("a"));
    expect(listQueue("t1")).toHaveLength(1);
  });

  it("replays with the original key and removes accepted sales", async () => {
    enqueueSale("t2", sale("k1"));
    const seen: (string | undefined)[] = [];
    const res = await syncQueue("t2", async (input) => { seen.push(input.idempotencyKey); return { success: true }; });
    expect(seen).toEqual(["k1"]);
    expect(res).toEqual({ synced: 1, failed: 0, remaining: 0 });
  });

  it("keeps a rejected sale with its reason and continues with the rest", async () => {
    enqueueSale("t3", sale("bad"));
    enqueueSale("t3", sale("good"));
    const res = await syncQueue("t3", async (input) => (input.idempotencyKey === "bad" ? { success: false, error: "Item removed" } : { success: true }));
    expect(res.synced).toBe(1);
    expect(res.failed).toBe(1);
    expect(listQueue("t3")).toMatchObject([{ key: "bad", error: "Item removed" }]);
  });

  it("stops and keeps everything on a connection error", async () => {
    enqueueSale("t4", sale("x"));
    enqueueSale("t4", sale("y"));
    const res = await syncQueue("t4", async () => { throw new Error("Failed to fetch"); });
    expect(res).toEqual({ synced: 0, failed: 0, remaining: 2 });
    removeQueuedSale("t4", "x");
    expect(listQueue("t4")).toHaveLength(1);
  });
});
