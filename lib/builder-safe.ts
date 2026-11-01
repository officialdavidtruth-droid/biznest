/**
 * Output-safety helpers for values the Website Builder stores as free text
 * (button links, image URLs, colours). They are used both when saving
 * (lib/builder-config.ts schema) and when rendering (builder-renderer.tsx,
 * hero-variants.tsx), so data saved before the schema was tightened is
 * still neutralised on the live storefront.
 */

const SAFE_HREF = /^(#[\w~.-]*|\/(?!\/)[^\s"'<>\\]*|https?:\/\/[^\s"'<>\\]+|mailto:[^\s"'<>\\]+|tel:[+\d\s().-]+)$/i;

/** True for "", in-page anchors, site-relative paths, http(s), mailto: and tel: links. */
export function isSafeHref(value: string | undefined | null): boolean {
  if (!value) return true;
  return SAFE_HREF.test(value.trim());
}

/** Returns the link if safe, otherwise the fallback. Blocks javascript:, data:, vbscript:, protocol-relative URLs. */
export function safeHref(value: string | undefined | null, fallback = "#"): string {
  const v = (value ?? "").trim();
  return v && SAFE_HREF.test(v) ? v : fallback;
}

const SAFE_IMAGE = /^(https:\/\/|http:\/\/|\/(?!\/))[^\s"'<>\\]+$/i;

/** True for "", an http(s) URL or a site-relative path with no quotes, parentheses or whitespace. */
export function isSafeImageUrl(value: string | undefined | null): boolean {
  if (!value) return true;
  return SAFE_IMAGE.test(value.trim());
}

/**
 * Stricter rule used when SAVING: https only (or a site-relative path). A plain http image on an https store is
 * blocked by browsers as mixed content, so it would just show as a broken picture.
 */
export function isSecureImageUrl(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  return isSafeImageUrl(v) && !/^http:\/\//i.test(v);
}

/** CSS-safe value for use inside `url(...)`. Returns `none` for unsafe input so nothing is injected into the style. Parentheses are percent-encoded. */
export function cssUrl(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  return v && SAFE_IMAGE.test(v) ? `"${v.replace(/\(/g, "%28").replace(/\)/g, "%29")}"` : "none";
}

/** Adds a generic fallback to a font name so a font that is not loaded still renders in a sensible face. */
export function fontStack(name: string | undefined | null): string {
  const n = (name ?? "").trim().replace(/["';{}<>\\]/g, "");
  if (!n) return "system-ui, sans-serif";
  return /,/.test(n) ? n : `"${n}", system-ui, sans-serif`;
}

const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s/-]*$/;

/** True for hex / rgb() / hsl() / named colours and simple gradients; false for anything that could break out of a declaration. */
export function isSafeColor(value: string | undefined | null): boolean {
  if (!value) return true;
  return SAFE_COLOR.test(value) && !/url\s*\(|expression|javascript|@import/i.test(value);
}
