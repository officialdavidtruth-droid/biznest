/**
 * Limits for store <-> customer conversation messages. Lives outside the
 * "use server" action files because those may only export async functions,
 * and the same constants are needed by both the server actions and the
 * client composer (textarea maxLength / counter).
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** Conversations shown per page in the dashboard inbox. */
export const CONVERSATIONS_PAGE_SIZE = 25;

// Fixed-window limits per user (see lib/rate-limit.ts).
export const CUSTOMER_MESSAGE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };
// Staff replying are trusted far more, but a runaway client or script is still capped.
export const STORE_REPLY_LIMIT = { max: 60, windowMs: 10 * 60 * 1000 };

/** Trims and validates message text. Returns the cleaned text, or an error string. */
export function validateMessageContent(raw: string): { ok: true; content: string } | { ok: false; error: string } {
  const content = (raw ?? "").trim();
  if (!content) return { ok: false, error: "Message can't be empty." };
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }
  return { ok: true, content };
}
