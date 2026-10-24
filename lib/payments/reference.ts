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
