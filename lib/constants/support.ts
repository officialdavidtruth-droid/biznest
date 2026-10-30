/**
 * Single source of truth for the BizNest support address. NEXT_PUBLIC_ so the
 * client-side help chat can read it too; falls back to the current inbox.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "biznestsupport@gmail.com";
