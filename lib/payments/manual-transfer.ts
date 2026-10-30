/**
 * Manual bank-transfer payments.
 *
 * A vendor publishes their own bank account (and WhatsApp number). The
 * customer transfers the money themselves, uploads proof of payment (an image or a document) and
 * the vendor confirms receipt. BizNest never holds or moves this money, so the
 * resulting Payment row is recorded as provider CASH ("settled outside the
 * platform"): no vendor payout is queued and refunds are recorded directly.
 *
 * Pure helpers only (safe to import from client components).
 */

export const MANUAL_PROVIDER = "CASH" as const;
export const MANUAL_TENDER_LABEL = "Bank transfer";

export type ManualPayInfo = {
  enabled: boolean;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  note: string | null;
  /** Digits only, international format (e.g. 2348012345678). */
  whatsapp: string | null;
  /** The store's call line, digits only, international format. May be the same number as `whatsapp`. */
  call: string | null;
};

type StoreLike = {
  manualPayEnabled?: boolean | null;
  manualBankName?: string | null;
  manualAccountName?: string | null;
  manualAccountNumber?: string | null;
  manualPayNote?: string | null;
  whatsappNumber?: string | null;
  contactPhone?: string | null;
  socialLinks?: unknown;
};

/**
 * Digits-only international number, or null if it can't be one.
 * "0801 234 5678" -> "2348012345678", "+234 801 234 5678" -> "2348012345678".
 */
export function normalizeWhatsapp(raw: string | null | undefined, defaultCountryCode = "234"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.slice(1);
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** wa.me link with an optional pre-filled message. */
export function whatsappLink(number: string | null | undefined, message?: string): string | null {
  const n = normalizeWhatsapp(number);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** tel: link for a call line. Null when the number can't be dialled. */
export function telLink(number: string | null | undefined): string | null {
  const n = normalizeWhatsapp(number);
  return n ? `tel:+${n}` : null;
}

/** True when two numbers are the same line, whatever format they were typed in. */
export function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeWhatsapp(a);
  const y = normalizeWhatsapp(b);
  return Boolean(x && y && x === y);
}

/** Readable form of a stored number: Nigerian numbers as 0801 234 5678, everything else as +<digits>. */
export function formatPhoneDisplay(number: string | null | undefined): string {
  const n = normalizeWhatsapp(number);
  if (!n) return "";
  if (n.startsWith("234") && n.length === 13) return `0${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
  return `+${n}`;
}

function socialWhatsapp(socialLinks: unknown): string | null {
  if (!socialLinks || typeof socialLinks !== "object") return null;
  const v = (socialLinks as Record<string, unknown>).whatsapp;
  return typeof v === "string" ? v : null;
}

/**
 * What a customer sees on the pay page. The WhatsApp number falls back to older
 * contact fields; the call line is the store's contact phone.
 */
export function manualPayInfoFromStore(store: StoreLike): ManualPayInfo {
  return {
    enabled: store.manualPayEnabled !== false,
    bankName: store.manualBankName?.trim() || null,
    accountName: store.manualAccountName?.trim() || null,
    accountNumber: store.manualAccountNumber?.trim() || null,
    note: store.manualPayNote?.trim() || null,
    whatsapp:
      normalizeWhatsapp(store.whatsappNumber) ??
      normalizeWhatsapp(socialWhatsapp(store.socialLinks)) ??
      normalizeWhatsapp(store.contactPhone),
    call: normalizeWhatsapp(store.contactPhone),
  };
}

/** A store can take transfer payments only once it has published a complete account. */
export function manualPayReady(info: ManualPayInfo): boolean {
  return info.enabled && Boolean(info.bankName && info.accountName && info.accountNumber);
}

export const PROOF_MAX_BYTES = 4 * 1024 * 1024; // stays under the serverless request body limit

/**
 * Proof of payment can be an image (screenshot or photo of a receipt) or a
 * document (bank PDF receipt, Word/Excel statement, text/CSV export).
 * Deliberately NOT "any file": executables, scripts, HTML and SVG are refused
 * because the vendor opens these files from their dashboard.
 */
export const PROOF_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

/** Value for <input accept>. */
export const PROOF_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

/** Proof files are stored as Cloudinary images (viewable inline) or raw documents. */
export function isImageProofUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes("/image/upload/"));
}
