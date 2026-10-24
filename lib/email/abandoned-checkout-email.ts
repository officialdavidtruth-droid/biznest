/**
 * Store-branded "you left something in your cart" email.
 *
 * This is a pure renderer (no Resend/Prisma imports) so it can be unit tested
 * and previewed without any infrastructure. The email is written from the
 * STORE's point of view -- its logo (or name as a wordmark), its brand colour,
 * its contact details -- because the customer was shopping with that store, not
 * with BizNest. BizNest is not mentioned anywhere in the email.
 */

export type AbandonedCheckoutEmailStore = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null; // store.themeColors.primary
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type AbandonedCheckoutEmailItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  variantLabel?: string | null;
  imageUrl?: string | null;
};

export type AbandonedCheckoutEmailInput = {
  recipientEmail: string;
  recipientName?: string | null;
  store: AbandonedCheckoutEmailStore;
  items: AbandonedCheckoutEmailItem[];
  currency: string;
  total: number;
  cartUrl: string;
  /** Platform base URL, used to resolve relative image paths. */
  appUrl: string;
};

const DEFAULT_BRAND = "#0f6410";
const MAX_ITEMS_SHOWN = 4;

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

/** Accepts #rgb / #rrggbb only -- anything else (named colours, rgb(), junk) falls back to the default. */
export function safeBrandColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  return DEFAULT_BRAND;
}

/** White or near-black, whichever reads better on the given hex background. */
export function readableTextOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}

function resolveImage(url: string | null | undefined, appUrl: string): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${appUrl}${v}`;
  return null;
}

/** Mixes a hex colour toward another by `amount` (0..1). */
export function mixHex(hex: string, toward: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * amount);
  };
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** Display name safe to put in a `From: "Name" <addr>` header. */
export function safeFromName(name: string): string {
  return name.replace(/["<>\r\n,;]/g, " ").replace(/\s+/g, " ").trim() || "Store";
}

export function abandonedCheckoutSubject(storeName: string) {
  return `You left something in your cart at ${storeName}`;
}

export function renderAbandonedCheckoutEmail(input: AbandonedCheckoutEmailInput): string {
  const { store, items, currency, total, cartUrl, appUrl } = input;
  const brand = safeBrandColor(store.primaryColor);
  const brandDark = mixHex(brand, "#000000", 0.28);
  const brandTint = mixHex(brand, "#ffffff", 0.92);
  const brandSoft = mixHex(brand, "#ffffff", 0.82);
  const onBrand = readableTextOn(brand);
  const onBrandMuted = onBrand === "#ffffff" ? "rgba(255,255,255,0.82)" : "rgba(17,24,39,0.72)";
  const buttonText = readableTextOn(brand);
  const storeName = escapeHtml(store.name);
  const firstName = input.recipientName?.trim().split(/\s+/)[0];
  const logo = resolveImage(store.logoUrl, appUrl);
  const safeCartUrl = escapeHtml(cartUrl);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const shown = items.slice(0, MAX_ITEMS_SHOWN);
  const hidden = items.length - shown.length;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const brandMark = logo
    ? `<img src="${escapeHtml(logo)}" alt="${storeName}" height="44" style="display:block;margin:0 auto;height:44px;max-width:220px;width:auto;border:0;outline:none;" />`
    : `<span style="font-size:20px;line-height:26px;font-weight:800;letter-spacing:-0.01em;color:#111827;">${storeName}</span>`;

  const headline = firstName
    ? totalItems > 1 ? `${escapeHtml(firstName)}, your cart is waiting` : `${escapeHtml(firstName)}, your pick is waiting`
    : totalItems > 1 ? "Your cart is waiting" : "Your pick is waiting";
  const lead =
    totalItems > 1
      ? `You left ${totalItems} items behind at ${storeName}. We saved them so you can finish in under a minute.`
      : `You left something behind at ${storeName}. We saved it so you can finish in under a minute.`;

  const itemRows = shown
    .map((item, idx) => {
      const img = resolveImage(item.imageUrl, appUrl);
      const initial = escapeHtml((item.name.trim()[0] ?? "•").toUpperCase());
      const thumb = img
        ? `<img src="${escapeHtml(img)}" alt="" width="80" height="80" style="display:block;width:80px;height:80px;border-radius:12px;object-fit:cover;border:1px solid #eceef1;" />`
        : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="80" height="80" style="width:80px;height:80px;border-radius:12px;background-color:${brandSoft};color:${brand};font-size:28px;font-weight:800;">${initial}</td></tr></table>`;
      const border = idx === shown.length - 1 && hidden === 0 ? "" : "border-bottom:1px solid #f0f1f3;";
      const chip = item.variantLabel
        ? `<span style="display:inline-block;margin-top:6px;padding:2px 9px;border-radius:999px;background-color:#f3f4f6;color:#4b5563;font-size:12px;line-height:18px;">${escapeHtml(item.variantLabel)}</span>`
        : "";
      return `
        <tr>
          <td width="92" valign="middle" style="padding:16px 0 16px 0;${border}">${thumb}</td>
          <td valign="middle" style="padding:16px 12px;${border}">
            <div style="color:#111827;font-size:16px;line-height:22px;font-weight:700;">${escapeHtml(item.name)}</div>
            ${chip}
            <div style="color:#6b7280;font-size:13px;line-height:20px;margin-top:4px;">Qty ${item.quantity} &nbsp;·&nbsp; ${escapeHtml(formatMoney(item.unitPrice, currency))} each</div>
          </td>
          <td align="right" valign="middle" style="padding:16px 0;${border}color:#111827;font-size:16px;line-height:22px;font-weight:700;white-space:nowrap;">${escapeHtml(formatMoney(item.unitPrice * item.quantity, currency))}</td>
        </tr>`;
    })
    .join("");

  const moreRow =
    hidden > 0
      ? `<tr><td colspan="3" style="padding:14px 0 4px;color:#6b7280;font-size:13px;line-height:18px;">+ ${hidden} more item${hidden === 1 ? "" : "s"} in your cart</td></tr>`
      : "";

  const trust = (icon: string, title: string, text: string) => `
    <td width="33%" valign="top" align="center" style="padding:0 6px;">
      <div style="font-size:20px;line-height:26px;">${icon}</div>
      <div style="margin-top:4px;color:#111827;font-size:12px;line-height:16px;font-weight:700;">${title}</div>
      <div style="margin-top:2px;color:#6b7280;font-size:11px;line-height:15px;">${text}</div>
    </td>`;

  const contactBits = [
    store.contactEmail ? `<a href="mailto:${escapeHtml(store.contactEmail)}" style="color:#4b5563;text-decoration:underline;">${escapeHtml(store.contactEmail)}</a>` : "",
    store.contactPhone ? escapeHtml(store.contactPhone) : "",
  ].filter(Boolean);

  const preheader = `Your saved items at ${store.name} are one tap away. Items can sell out.`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(abandonedCheckoutSubject(store.name))}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${brandTint};font-family:${font};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brandTint};">
      <tr>
        <td align="center" style="padding:28px 12px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
            <tr><td align="center" style="padding:4px 0 20px;">${brandMark}</td></tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(16,24,40,0.08);">
                  <tr>
                    <td align="center" bgcolor="${brand}" style="background-color:${brand};background-image:linear-gradient(135deg,${brand} 0%,${brandDark} 100%);padding:44px 32px 40px;">
                      <span style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:rgba(255,255,255,0.18);color:${onBrand};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">&#128722;&nbsp; Cart saved</span>
                      <h1 style="margin:18px 0 10px;color:${onBrand};font-size:30px;line-height:38px;font-weight:800;letter-spacing:-0.02em;">${headline}</h1>
                      <p style="margin:0 auto;max-width:400px;color:${onBrandMuted};font-size:15px;line-height:24px;">${lead}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px 32px 4px;">
                      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Your order</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${itemRows}
                        ${moreRow}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brandTint};border-radius:14px;">
                        <tr>
                          <td style="padding:18px 20px;color:#374151;font-size:15px;line-height:20px;font-weight:600;">Order total</td>
                          <td align="right" style="padding:18px 20px;color:#111827;font-size:22px;line-height:26px;font-weight:800;letter-spacing:-0.01em;white-space:nowrap;">${escapeHtml(formatMoney(total, currency))}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:28px 32px 6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" bgcolor="${brand}" style="border-radius:14px;background-color:${brand};">
                            <a href="${safeCartUrl}" style="display:block;padding:18px 24px;color:${buttonText};font-size:17px;line-height:22px;font-weight:800;text-decoration:none;border-radius:14px;">Complete your order &nbsp;&rarr;</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:18px;">Popular items can sell out, so don't wait too long.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f1f3;">
                        <tr>
                          <td style="padding-top:22px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                ${trust("&#128274;", "Secure payment", "Encrypted checkout")}
                                ${trust("&#128190;", "Cart saved", "Nothing to re-add")}
                                ${trust("&#128172;", "Real support", "Just reply to this email")}
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 32px 32px;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:18px;word-break:break-all;">Button not working? Copy this link:<br /><a href="${safeCartUrl}" style="color:${brand};text-decoration:underline;">${safeCartUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 24px 0;">
                <p style="margin:0 0 4px;color:#111827;font-size:14px;line-height:20px;font-weight:700;">${storeName}</p>
                ${contactBits.length ? `<p style="margin:0 0 12px;color:#6b7280;font-size:12px;line-height:18px;">${contactBits.join(" &nbsp;·&nbsp; ")}</p>` : ""}
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:17px;">You're receiving this because you started a checkout at ${storeName} using ${escapeHtml(input.recipientEmail)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
