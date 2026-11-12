/**
 * Offline storage for the Point of Sale.
 *
 * What it does: keeps a copy of the register's catalogue and a queue of sales rung up with no
 * connection. When the connection is back the register replays each queued sale through
 * createPosSale with the SAME idempotency key it was rung up with, so a sale that did reach the
 * server before the connection dropped can never be recorded twice (Order.idempotencyKey is unique).
 *
 * Where it stores: the BizNest desktop app exposes `window.bizNestDesktop.storage` (a JSON file in
 * the app's own data folder, so it survives clearing the browser). Everywhere else it falls back to
 * localStorage. Both are synchronous-looking key/value stores, so one small adapter covers them.
 */
import type { PosCatalogItem } from "@/lib/actions/pos";
import type { PosSaleInput } from "@/lib/validations/pos";

export type QueuedSale = {
  /** Also the server-side idempotency key. */
  key: string;
  input: PosSaleInput;
  /** Total the cashier saw, shown in the "waiting to sync" list. */
  total: number;
  currency: string;
  createdAt: number;
  /** Set when the server rejected the sale (e.g. item removed, plan limit). The cashier must resolve it. */
  error?: string;
};

type KV = { get(key: string): string | null; set(key: string, value: string): void };

declare global {
  interface Window {
    bizNestDesktop?: { storage?: KV; isDesktop?: boolean };
  }
}

const memory = new Map<string, string>();

function store(): KV {
  if (typeof window !== "undefined") {
    const desktop = window.bizNestDesktop?.storage;
    if (desktop) return desktop;
    try {
      const ls = window.localStorage;
      ls.getItem("__bn_probe");
      return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) };
    } catch {
      /* storage blocked: fall through to memory */
    }
  }
  return { get: (k) => memory.get(k) ?? null, set: (k, v) => void memory.set(k, v) };
}

const catalogKey = (slug: string) => `bn.pos.catalog.${slug}`;
const queueKey = (slug: string) => `bn.pos.queue.${slug}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store().get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveCatalog(slug: string, items: PosCatalogItem[]): void {
  try {
    store().set(catalogKey(slug), JSON.stringify({ savedAt: Date.now(), items }));
    store().set("bn.pos.lastSlug", slug);
  } catch {
    /* quota or blocked: offline copy is a convenience, never fatal */
  }
}

export function loadCatalog(slug: string): { savedAt: number; items: PosCatalogItem[] } | null {
  return readJson<{ savedAt: number; items: PosCatalogItem[] } | null>(catalogKey(slug), null);
}

export function listQueue(slug: string): QueuedSale[] {
  return readJson<QueuedSale[]>(queueKey(slug), []);
}

function writeQueue(slug: string, queue: QueuedSale[]): void {
  store().set(queueKey(slug), JSON.stringify(queue));
}

/** Adds a sale to the queue. Re-queueing the same key (a retry of the same sale) is a no-op. */
export function enqueueSale(slug: string, sale: QueuedSale): QueuedSale[] {
  const queue = listQueue(slug);
  if (queue.some((q) => q.key === sale.key)) return queue;
  const next = [...queue, sale];
  writeQueue(slug, next);
  return next;
}

export function removeQueuedSale(slug: string, key: string): QueuedSale[] {
  const next = listQueue(slug).filter((q) => q.key !== key);
  writeQueue(slug, next);
  return next;
}

export function markQueuedSaleFailed(slug: string, key: string, error: string): void {
  writeQueue(slug, listQueue(slug).map((q) => (q.key === key ? { ...q, error } : q)));
}

/** True for failures that mean "no connection / server unreachable" rather than "the server said no". */
export function isConnectionError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|connection/i.test(msg);
}

export type SyncResult = { synced: number; failed: number; remaining: number };

/**
 * Replays queued sales oldest-first. `send` is createPosSale. A connection error stops the run
 * (keep everything for the next try); a rejected sale is marked with the server's reason and skipped
 * so one bad sale never blocks the rest.
 */
export async function syncQueue(
  slug: string,
  send: (input: PosSaleInput) => Promise<{ success: boolean; error?: string }>,
): Promise<SyncResult> {
  let synced = 0;
  let failed = 0;
  for (const sale of listQueue(slug)) {
    if (sale.error) continue;
    try {
      const res = await send({ ...sale.input, idempotencyKey: sale.key });
      if (res.success) {
        removeQueuedSale(slug, sale.key);
        synced++;
      } else {
        markQueuedSaleFailed(slug, sale.key, res.error ?? "The server rejected this sale.");
        failed++;
      }
    } catch (err) {
      if (isConnectionError(err)) break;
      markQueuedSaleFailed(slug, sale.key, "Could not be recorded. Try again when online.");
      failed++;
    }
  }
  return { synced, failed, remaining: listQueue(slug).length };
}
