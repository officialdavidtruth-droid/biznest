// Browse post drafts. Kept on the vendor's own device (IndexedDB), one per store,
// because photos and videos are too big for localStorage. Never throws: if the
// browser blocks storage the composer simply works without drafts.
import type { Sticker } from "@/lib/browse";

export type DraftPerson = { kind: "store" | "user"; id: string; name: string; sub: string; logoUrl: string | null };

export type BrowseDraft = {
  files: File[];
  isVideo: boolean;
  duration: number | null;
  trim: { start: number; end: number };
  coverRel: number;
  customCover: File | null;
  items: Sticker[];
  caption: string;
  tag: string;
  location: string;
  ai: boolean;
  people: DraftPerson[];
  savedAt: number;
};

const DB = "biznest-browse-drafts";
const STORE = "drafts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req.result ?? null); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

export async function loadDraft(slug: string): Promise<BrowseDraft | null> {
  const d = await run<BrowseDraft>("readonly", (s) => s.get(slug));
  return d && Array.isArray(d.files) ? d : null;
}

export async function saveDraft(slug: string, draft: Omit<BrowseDraft, "savedAt">): Promise<boolean> {
  const ok = await run<IDBValidKey>("readwrite", (s) => s.put({ ...draft, savedAt: Date.now() }, slug));
  return ok !== null;
}

export async function clearDraft(slug: string): Promise<void> {
  await run("readwrite", (s) => s.delete(slug));
}
