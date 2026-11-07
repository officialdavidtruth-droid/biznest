/**
 * Only same-site paths may be used as a post-login destination.
 * Rejects absolute URLs, protocol-relative ("//host"), backslash tricks ("/\host"),
 * and anything with control characters, so a crafted ?callbackUrl= can't send a signed-in
 * user to another site or run a javascript: URL.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const v = raw.trim();
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return fallback;
  return v;
}
