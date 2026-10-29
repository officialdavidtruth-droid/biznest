/**
 * Helpers for showing a guest's details on pages that are reachable by link
 * alone (e.g. the public booking confirmation page). Links get shared,
 * forwarded, and stored in browser history, so these pages must not print
 * full contact details.
 */

/** "jane.doe@gmail.com" -> "j•••@g•••.com" (keeps enough to recognise it). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}•••@${host[0] ?? ""}•••${tld}`;
}

/** First name only: "Jane Q. Doe" -> "Jane". Falls back to the given default. */
export function firstName(name: string | null | undefined, fallback = "Guest"): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || fallback;
}
