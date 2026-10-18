import { sanitizeCustomUrl } from "@/lib/storefront-menu";

/**
 * Block model for custom store pages (the WordPress-style page builder).
 * Shared by the server action (sanitising), the storefront renderer and the
 * dashboard editor. No "use client" / "use server" so it works in all three.
 */

export type PageBlock = { id: string } & (
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; caption: string }
  | { type: "button"; label: string; href: string }
  | { type: "quote"; text: string; author: string }
  | { type: "list"; items: string[] }
  | { type: "divider" }
  | { type: "spacer"; size: "sm" | "md" | "lg" }
  | { type: "products"; title: string; kind: "all" | "products" | "services"; limit: number }
  | { type: "contact"; title: string }
);

export type PageBlockType = PageBlock["type"];

export const BLOCK_LIBRARY: { type: PageBlockType; label: string; hint: string }[] = [
  { type: "heading", label: "Heading", hint: "Section title" },
  { type: "text", label: "Paragraph", hint: "Body text" },
  { type: "image", label: "Image", hint: "Upload a photo" },
  { type: "button", label: "Button", hint: "Link to anywhere" },
  { type: "products", label: "Menu / Catalog", hint: "Show your items" },
  { type: "list", label: "List", hint: "Bulleted points" },
  { type: "quote", label: "Quote", hint: "Highlight a line" },
  { type: "contact", label: "Contact info", hint: "Phone, email, address" },
  { type: "divider", label: "Divider", hint: "Horizontal line" },
  { type: "spacer", label: "Spacer", hint: "Empty space" },
];

export const MAX_BLOCKS = 60;
const MAX_TEXT = 5000;
const MAX_LIST_ITEMS = 30;

export function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createBlock(type: PageBlockType): PageBlock {
  const id = newBlockId();
  switch (type) {
    case "heading": return { id, type, text: "", level: 2 };
    case "text": return { id, type, text: "" };
    case "image": return { id, type, url: "", alt: "", caption: "" };
    case "button": return { id, type, label: "Learn more", href: "" };
    case "quote": return { id, type, text: "", author: "" };
    case "list": return { id, type, items: [""] };
    case "divider": return { id, type };
    case "spacer": return { id, type, size: "md" };
    case "products": return { id, type, title: "", kind: "all", limit: 6 };
    case "contact": return { id, type, title: "Get in touch" };
  }
}

function str(v: unknown, max = MAX_TEXT): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function safeImageUrl(v: unknown): string {
  const s = str(v, 2000).trim();
  if (/^https:\/\//i.test(s)) return s;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "";
}

/** Validates untrusted JSON into PageBlock[]. Unknown/invalid blocks are dropped. */
export function sanitizeBlocks(input: unknown): PageBlock[] {
  if (!Array.isArray(input)) return [];
  const out: PageBlock[] = [];
  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const id = str(b.id, 24).replace(/[^a-z0-9]/gi, "") || newBlockId();
    switch (b.type) {
      case "heading":
        out.push({ id, type: "heading", text: str(b.text, 200), level: b.level === 1 || b.level === 3 ? b.level : 2 });
        break;
      case "text":
        out.push({ id, type: "text", text: str(b.text) });
        break;
      case "image":
        out.push({ id, type: "image", url: safeImageUrl(b.url), alt: str(b.alt, 200), caption: str(b.caption, 300) });
        break;
      case "button": {
        const href = sanitizeCustomUrl(str(b.href, 2000)) ?? "";
        out.push({ id, type: "button", label: str(b.label, 60), href });
        break;
      }
      case "quote":
        out.push({ id, type: "quote", text: str(b.text, 600), author: str(b.author, 100) });
        break;
      case "list": {
        const items = Array.isArray(b.items) ? b.items.slice(0, MAX_LIST_ITEMS).map((i) => str(i, 300)) : [];
        out.push({ id, type: "list", items });
        break;
      }
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "spacer":
        out.push({ id, type: "spacer", size: b.size === "sm" || b.size === "lg" ? b.size : "md" });
        break;
      case "products": {
        const kind = b.kind === "products" || b.kind === "services" ? b.kind : "all";
        const limit = Math.min(24, Math.max(1, Math.round(Number(b.limit) || 6)));
        out.push({ id, type: "products", title: str(b.title, 120), kind, limit });
        break;
      }
      case "contact":
        out.push({ id, type: "contact", title: str(b.title, 120) });
        break;
    }
  }
  return out;
}

/** True when a block has nothing worth showing publicly. */
export function isBlockEmpty(b: PageBlock): boolean {
  switch (b.type) {
    case "heading": case "text": case "quote": return !b.text.trim();
    case "image": return !b.url;
    case "button": return !b.label.trim() || !b.href;
    case "list": return !b.items.some((i) => i.trim());
    default: return false;
  }
}

/**
 * Blocks for a stored page. Pages saved before the builder existed only have
 * a plain `body`; that is surfaced as a single paragraph block so nothing is lost.
 */
export function getPageBlocks(content: unknown): PageBlock[] {
  const c = (content ?? {}) as { body?: unknown; blocks?: unknown };
  const blocks = sanitizeBlocks(c.blocks);
  if (blocks.length) return blocks;
  const body = typeof c.body === "string" ? c.body.trim() : "";
  return body ? [{ id: "legacy", type: "text", text: body }] : [];
}

export function hasVisibleContent(blocks: PageBlock[]): boolean {
  return blocks.some((b) => !isBlockEmpty(b) && b.type !== "divider" && b.type !== "spacer");
}
