import "server-only";

/**
 * Signed share tokens for customer-facing quote and invoice links.
 *
 * A token is an HMAC of "<kind>:<id>" under AUTH_SECRET, so it can't be guessed from
 * the document id. The "quote" format is unchanged from the original implementation,
 * so links that were already emailed keep working.
 */

export type DocKind = "quote" | "invoice";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured.");
  return value;
}

export async function signDocToken(kind: DocKind, id: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${kind}:${id}`));
  return Buffer.from(sig).toString("base64url");
}

export async function verifyDocToken(kind: DocKind, id: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await signDocToken(kind, id);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Absolute customer-facing URL for a document, carrying its token (plus any extra query params). */
export async function customerDocUrl(appUrl: string, kind: DocKind, id: string, extra: Record<string, string> = {}): Promise<string> {
  const params = new URLSearchParams({ token: await signDocToken(kind, id), ...extra });
  return `${appUrl}/${kind === "invoice" ? "invoices" : "quotes"}/${id}?${params.toString()}`;
}

/**
 * Invoice links emailed before tokens existed look like /invoices/<id>. So customers
 * with an outstanding invoice aren't locked out, invoices first sent before this
 * moment stay viewable without a token. Set INVOICE_LINK_TOKEN_REQUIRED_FROM (an ISO
 * date) to the time this change is deployed.
 */
export function invoiceTokenRequiredFrom(): Date {
  const fallback = new Date("2026-11-03T00:00:00Z");
  const raw = process.env.INVOICE_LINK_TOKEN_REQUIRED_FROM;
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
