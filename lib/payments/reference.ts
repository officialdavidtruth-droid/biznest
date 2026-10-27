import { randomUUID } from "crypto";

/**
 * Gateway references have length limits (Korapay rejects anything over 50
 * characters). A cuid id is 25 chars, so `PREFIX-<id>-<token>` must keep the
 * token short: 12 hex chars is still ~48 bits of randomness, plenty to make a
 * retried payment attempt unique.
 */
export function shortToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Collapses a gateway reference that arrived with its own prefix+id repeated
 * ("BK-<id>-BK-<id>-<token>") back to the one we actually issued
 * ("BK-<id>-<token>"). Anything that doesn't match that exact shape is
 * returned untouched, so this can never rewrite a legitimate reference.
 */
export function canonicalizeReference(reference: string): string {
  const m = reference.match(/^(BK|WAL|RES)-([A-Za-z0-9]+)-\1-\2-([a-f0-9]{12})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : reference;
}
