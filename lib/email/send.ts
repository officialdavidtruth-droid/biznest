import { Resend } from "resend";
import { logError } from "@/lib/observability/log";
import { APP_URL } from "@/lib/constants/app-url";
import {
  abandonedCheckoutSubject,
  renderAbandonedCheckoutEmail,
  safeFromName,
  type AbandonedCheckoutEmailInput,
} from "@/lib/email/abandoned-checkout-email";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "BizNest <no-reply@biznest.space>";
const FROM_ADDRESS = FROM.match(/<(.+)>/)?.[1] ?? FROM;

/**
 * Every send goes through here so a bounced/rejected/misconfigured email
 * always lands a SystemEvent, regardless of which of the helpers below
 * (or a future one) triggered it. Resend's SDK resolves with
 * { data, error } rather than throwing on API-level failures, so we check
 * both that and a genuine throw (network blip, bad API key at the client
 * level, etc).
 */
async function send(params: Parameters<typeof resend.emails.send>[0], context: { kind: string; to: string }) {
  try {
    const result = await resend.emails.send(params);
    if (result.error) {
      void logError("EMAIL", `Send failed: ${context.kind}`, { to: context.to, message: result.error.message });
    }
    return result;
  } catch (err) {
    void logError("EMAIL", `Send threw: ${context.kind}`, {
      to: context.to,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Identity of the store an email is sent on behalf of. */
export type StoreEmailBrand = {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

/** "Store Name <no-reply@…>" — strips characters that would break the From header. */
function fromFor(brand?: StoreEmailBrand) {
  return brand ? `${safeFromName(brand.name)} <${FROM_ADDRESS}>` : FROM;
}

/** Builds the email identity for a Store row (or any object with the same fields). */
export function storeEmailBrand(store: {
  name: string;
  logoUrl?: string | null;
  themeColors?: unknown;
  contactEmail?: string | null;
  contactPhone?: string | null;
}): StoreEmailBrand {
  const theme = (store.themeColors ?? null) as { primary?: string } | null;
  return {
    name: store.name,
    logoUrl: store.logoUrl ?? null,
    color: /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(theme?.primary ?? "") ? theme!.primary! : null,
    contactEmail: store.contactEmail ?? null,
    contactPhone: store.contactPhone ?? null,
  };
}

function brandShellOpts(brand: StoreEmailBrand) {
  return {
    brand,
    headerLogoUrl: brand.logoUrl ?? undefined,
    headerLogoAlt: brand.name,
    headerColor: brand.color ?? undefined,
  };
}

/**
 * Shared wrapper for every transactional email: branded header, card shell,
 * message-specific footer note, then a consistent company-info block (logo
 * wordmark, one-line description, legal links, support address, copyright)
 * that's identical across every email regardless of which one it is.
 *
 * Header uses BOTH an <img> (public/email-logo.png, hosted so it works from
 * any inbox) and an alt attribute carrying the text wordmark — most clients
 * that block remote images by default (Outlook for unknown senders, some
 * corporate filters) still render the alt text on the colored background,
 * so the header never shows a bare broken-image icon either way.
 */
function emailShell(opts: {
  preheader?: string;
  body: string;
  footer: string;
  headerLogoUrl?: string;
  headerLogoAlt?: string;
  headerColor?: string;
  /** When set, the email is sent AS this store: no BizNest name, links or copyright anywhere. */
  brand?: StoreEmailBrand;
}) {
  const headerColor = opts.headerColor ?? "#0b6413";
  const logoSrc = opts.headerLogoUrl ?? `${APP_URL}/email-logo.png`;
  const logoAlt = escapeHtml(opts.brand?.name ?? opts.headerLogoAlt ?? "BizNest");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:${headerColor};padding:18px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${
                        opts.brand && !opts.headerLogoUrl
                          ? `<span style="display:block;color:#ffffff;font-size:20px;font-weight:700;line-height:32px;">${logoAlt}</span>`
                          : opts.headerLogoUrl
                          ? `<img
                              src="${logoSrc}"
                              alt="${logoAlt}"
                              height="32"
                              style="display:block;height:32px;max-width:160px;width:auto;border:0;outline:none;"
                            />`
                          : `<img
                              src="${logoSrc}"
                              alt="${logoAlt}"
                              width="70"
                              height="32"
                              style="display:block;height:32px;width:70px;border:0;outline:none;"
                            />`
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${opts.body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #f0f0f0;">
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:18px;">${opts.footer}</p>
              </td>
            </tr>
            ${
              opts.brand
                ? `<tr>
              <td style="padding:20px 32px 24px;background-color:#f9fafb;border-top:1px solid #f0f0f0;">
                <p style="margin:0 0 6px;color:#374151;font-size:12px;font-weight:600;">${escapeHtml(opts.brand.name)}</p>
                ${
                  opts.brand.contactEmail || opts.brand.contactPhone
                    ? `<p style="margin:0 0 10px;font-size:11px;line-height:18px;color:#6b7280;">${[
                        opts.brand.contactEmail
                          ? `<a href="mailto:${escapeHtml(opts.brand.contactEmail)}" style="color:${escapeHtml(opts.brand.color ?? "#0f6410")};text-decoration:none;">${escapeHtml(opts.brand.contactEmail)}</a>`
                          : "",
                        opts.brand.contactPhone ? escapeHtml(opts.brand.contactPhone) : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}</p>`
                    : ""
                }
                <p style="margin:0;color:#c4cbd4;font-size:10px;">© ${new Date().getFullYear()} ${escapeHtml(opts.brand.name)}. All rights reserved.</p>
              </td>
            </tr>`
                : `<tr>
              <td style="padding:20px 32px 24px;background-color:#f9fafb;border-top:1px solid #f0f0f0;">
                <p style="margin:0 0 6px;color:#374151;font-size:12px;font-weight:600;">
                  BizNest
                </p>
                <p style="margin:0 0 10px;color:#9ca3af;font-size:11px;line-height:16px;">
                  A verified marketplace for products, services, and bookings.
                </p>
                <p style="margin:0 0 10px;font-size:11px;line-height:18px;">
                  <a href="${APP_URL}" style="color:#0f6410;text-decoration:none;">biznest.space</a>
                  <span style="color:#d1d5db;"> · </span>
                  <a href="mailto:support@biznest.space" style="color:#0f6410;text-decoration:none;">support@biznest.space</a>
                  <span style="color:#d1d5db;"> · </span>
                  <a href="${APP_URL}/privacy" style="color:#0f6410;text-decoration:none;">Privacy Policy</a>
                  <span style="color:#d1d5db;"> · </span>
                  <a href="${APP_URL}/terms" style="color:#0f6410;text-decoration:none;">Terms of Service</a>
                </p>
                <p style="margin:0;color:#c4cbd4;font-size:10px;">
                  © ${new Date().getFullYear()} BizNest. All rights reserved.
                </p>
              </td>
            </tr>`
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendStaffInviteEmail(
  email: string,
  storeName: string,
  inviterName: string,
  role: "MANAGER" | "STAFF",
  staffName: string,
  position: string,
  permissions: string[],
  username: string,
  storeSlug: string,
  password: string
) {
  const { labelForPermission } = await import("@/lib/access/staff-permissions");
  const loginUrl = `${APP_URL}/login`;
  const loginHandle = `${username}@${storeSlug}`;
  const roleLabel = role === "MANAGER" ? "Manager" : "Staff member";
  const permissionsList = permissions
    .map(
      (p) =>
        `<tr><td style="padding:6px 0;color:#374151;font-size:14px;line-height:20px;">
           <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#0f6410;margin-right:10px;vertical-align:middle;"></span>
           ${labelForPermission(p)}
         </td></tr>`
    )
    .join("");

  const html = emailShell({
    preheader: `${inviterName} added you to ${storeName} on BizNest`,
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Hi ${staffName},</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        <strong>${inviterName}</strong> added you to <strong>${storeName}</strong> on BizNest as
        a <strong>${position}</strong> (${roleLabel}). Your account is ready to use.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <tr>
          <td style="padding-bottom:8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
            Your login details
          </td>
        </tr>
        <tr>
          <td style="padding:2px 0;color:#111827;font-size:14px;line-height:22px;">
            Username: <strong>${loginHandle}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:2px 0 8px;color:#111827;font-size:14px;line-height:22px;">
            Password: <strong>${password}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding-top:4px;color:#9ca3af;font-size:12px;line-height:18px;">
            Keep this somewhere private and delete this email once you've signed in.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <tr>
          <td style="padding-bottom:4px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
            You'll have access to
          </td>
        </tr>
        ${permissionsList}
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:#0f6410;">
            <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              Sign in
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;">
        If the button doesn't work, go to ${loginUrl} and sign in with the username and password above.
      </p>
    `,
    footer: `This email was sent because someone added ${email} as a team member on BizNest.
      If you weren't expecting this, you can safely ignore this email.`,
  });

  return send(
    {
      from: FROM,
      to: email,
      subject: `${inviterName} added you to ${storeName} on BizNest`,
      html,
    },
    { kind: "staff-invite", to: email }
  );
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  store?: {
    storeName: string;
    logoUrl?: string | null;
    primaryColor?: string;
    storeSlug?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
  }
) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  const brandColor = store?.primaryColor ?? "#0b6413";
  const buttonColor = store?.primaryColor ?? "#0f6410";
  const storeName = store?.storeName;
  const brand: StoreEmailBrand | undefined = store
    ? { name: store.storeName, logoUrl: store.logoUrl, color: store.primaryColor, contactEmail: store.contactEmail, contactPhone: store.contactPhone }
    : undefined;

  const html = emailShell({
    preheader: storeName ? `Confirm your email to finish signing up with ${storeName}` : "Confirm your email to get started on BizNest",
    ...(brand ? brandShellOpts(brand) : { headerLogoAlt: "BizNest", headerColor: brandColor }),
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">
        Welcome${storeName ? ` to ${storeName}` : " to BizNest"} 👋
      </p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        Confirm your email address to finish setting up your account${storeName ? ` with ${storeName}` : ""} and get started.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${buttonColor};">
            <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              Verify email
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:20px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;word-break:break-all;">
        <a href="${url}" style="color:${buttonColor};font-size:13px;text-decoration:underline;">${url}</a>
      </p>

      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;">
        This link expires in 24 hours.
      </p>
    `,
    footer: storeName
      ? `This email was sent to ${email} because an account was created with this address on ${escapeHtml(storeName)}.
      If you didn't do this, you can safely ignore this email.`
      : `This email was sent to ${email} because an account was created with this address on BizNest.
      If you didn't do this, you can safely ignore this email.`,
  });

  return send(
    {
      from: fromFor(brand),
      reply_to: brand?.contactEmail ?? undefined,
      to: email,
      subject: storeName ? `Verify your email for ${storeName}` : "Verify your BizNest email",
      html,
    },
    { kind: "verification", to: email }
  );
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  storeSlug?: string,
  brand?: StoreEmailBrand
) {
  const url = `${APP_URL}/reset-password?token=${token}${storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : ""}`;

  const accountLabel = brand ? escapeHtml(brand.name) : "BizNest";
  const buttonColor = brand?.color ?? "#0f6410";

  const html = emailShell({
    preheader: `Reset your ${brand ? brand.name : "BizNest"} password`,
    ...(brand ? brandShellOpts(brand) : {}),
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Reset your password</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        We received a request to reset the password for your ${accountLabel} account. Click the button below to
        choose a new one.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${buttonColor};">
            <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              Reset password
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:20px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;word-break:break-all;">
        <a href="${url}" style="color:${buttonColor};font-size:13px;text-decoration:underline;">${url}</a>
      </p>

      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `,
    footer: `This email was sent to ${email} because a password reset was requested for this ${accountLabel} account.`,
  });

  return send(
    {
      from: fromFor(brand),
      reply_to: brand?.contactEmail ?? undefined,
      to: email,
      subject: `Reset your ${brand ? safeFromName(brand.name) : "BizNest"} password`,
      html,
    },
    { kind: "password-reset", to: email }
  );
}

export async function sendBusinessStatusEmail(
  email: string,
  status: "APPROVED" | "REJECTED",
  reason?: string,
  details?: { businessName?: string; category?: string; storeSlug?: string }
) {
  const approved = status === "APPROVED";
  const subject = approved ? "You're verified — welcome to BizNest 🎉" : "Update on your BizNest verification";

  const niche = details?.category?.trim();
  const bizName = details?.businessName?.trim();
  const storeUrl = details?.storeSlug ? `${APP_URL}/${details.storeSlug}` : `${APP_URL}/onboarding/business-verification`;
  const loginUrl = `${APP_URL}/login`;

  const html = emailShell({
    preheader: subject,
    body: approved
      ? `
        <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">
          Welcome to BizNest${bizName ? `, ${bizName}` : ""} 🎉
        </p>
        <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:24px;">
          Great news — your business has been reviewed and verified. Your${niche ? ` <strong>${niche}</strong>` : ""}
          store is officially live on BizNest, and you're ready to start selling.
        </p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
          BizNest is built to help businesses${niche ? ` like yours in ${niche}` : ""} grow without the overhead of
          running a storefront from scratch — a verified marketplace presence, secure checkout, built-in
          fraud protection, and tools for orders, inventory, and staff, all in one place. Our verification
          process exists so every business on the platform is trustworthy, which means customers shop with
          more confidence — and that works in your favor.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
          <tr>
            <td align="center" style="border-radius:8px;background-color:#0f6410;">
              <a href="${storeUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                Open your store
              </a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr>
            <td align="center" style="border-radius:8px;border:1px solid #d1d5db;">
              <a href="${loginUrl}" style="display:inline-block;padding:11px 28px;color:#111827;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                Sign in to your dashboard
              </a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:14px 18px;margin-bottom:8px;">
          <tr>
            <td style="color:#6b7280;font-size:12px;line-height:20px;">
              A few things worth a look as you get started:
              <a href="${APP_URL}/privacy" style="color:#0f6410;text-decoration:none;">Privacy Policy</a>
              <span style="color:#d1d5db;"> · </span>
              <a href="${APP_URL}/onboarding/fraud-policy" style="color:#0f6410;text-decoration:none;">Fraud Policy</a>
              <span style="color:#d1d5db;"> · </span>
              <a href="${APP_URL}/terms" style="color:#0f6410;text-decoration:none;">Terms &amp; Legal</a>
            </td>
          </tr>
        </table>
      `
      : `
        <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Verification update</p>
        <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:24px;">
          Your business verification could not be approved as submitted.
        </p>
        ${
          reason
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
                <tr>
                  <td style="color:#991b1b;font-size:13px;line-height:20px;">${reason}</td>
                </tr>
              </table>`
            : ""
        }
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
          You can correct the details above and resubmit for review at any time.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
          <tr>
            <td align="center" style="border-radius:8px;background-color:#0f6410;">
              <a href="${APP_URL}/onboarding/business-verification" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                Resubmit for review
              </a>
            </td>
          </tr>
        </table>
      `,
    footer: `This email was sent to ${email} regarding a business verification submitted on BizNest.`,
  });

  return send({ from: FROM, to: email, subject, html }, { kind: "business-status", to: email });
}

export type OrderConfirmationLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  variantLabel?: string | null;
};

export async function sendOrderConfirmationEmail(
  email: string,
  order: {
    id: string;
    storeName: string;
    storeSlug: string;
    storeLogoUrl?: string | null;
    storeColor?: string | null;
    storeContactEmail?: string | null;
    storeContactPhone?: string | null;
    currency: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    createdAt: Date;
    items: OrderConfirmationLineItem[];
  }
) {
  const fmt = (n: number) => `${order.currency} ${n.toLocaleString()}`;
  const orderUrl = `${APP_URL}/orders/${order.id}`;

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#111827;font-size:14px;line-height:20px;">
            ${item.name}${item.variantLabel ? `<br/><span style="color:#9ca3af;font-size:12px;">${item.variantLabel}</span>` : ""}
          </td>
          <td align="center" style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;line-height:20px;">
            ${item.quantity}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#111827;font-size:14px;line-height:20px;">
            ${fmt(item.unitPrice * item.quantity)}
          </td>
        </tr>
      `
    )
    .join("");

  const subject = `Order confirmed — ${order.storeName}`;

  const brand: StoreEmailBrand = {
    name: order.storeName,
    logoUrl: order.storeLogoUrl,
    color: order.storeColor,
    contactEmail: order.storeContactEmail,
    contactPhone: order.storeContactPhone,
  };
  const buttonColor = brand.color ?? "#0f6410";

  const html = emailShell({
    preheader: subject,
    ...brandShellOpts(brand),
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Thanks for your order!</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        Your order from <strong>${escapeHtml(order.storeName)}</strong> has been placed and is being processed.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="padding:0 0 8px;border-bottom:2px solid #111827;color:#111827;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">Item</td>
          <td align="center" style="padding:0 0 8px;border-bottom:2px solid #111827;color:#111827;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">Qty</td>
          <td align="right" style="padding:0 0 8px;border-bottom:2px solid #111827;color:#111827;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">Amount</td>
        </tr>
        ${itemRows}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;">Subtotal</td>
          <td align="right" style="padding:4px 0;color:#111827;font-size:13px;">${fmt(order.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;">Delivery</td>
          <td align="right" style="padding:4px 0;color:#111827;font-size:13px;">${fmt(order.deliveryFee)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0 0;border-top:1px solid #e5e7eb;color:#111827;font-size:15px;font-weight:600;">Total</td>
          <td align="right" style="padding:8px 0 0;border-top:1px solid #e5e7eb;color:#111827;font-size:15px;font-weight:600;">${fmt(order.total)}</td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${buttonColor};">
            <a href="${orderUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              View your order
            </a>
          </td>
        </tr>
      </table>
    `,
    footer: `This email was sent to ${email} regarding an order placed with ${escapeHtml(order.storeName)}.`,
  });

  return send(
    { from: fromFor(brand), reply_to: brand.contactEmail ?? undefined, to: email, subject, html },
    { kind: "order-confirmation", to: email }
  );
}

export type BookingConfirmationDetails = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED";
  serviceName: string;
  price: number;
  currency: string;
  // Appointment-style bookings: pass date + time. Stay-style bookings
  // (checkIn/checkOut range): pass checkIn/checkOut instead and omit date/time.
  date?: string; // pre-formatted, e.g. "Fri, Aug 28, 2026"
  time?: string; // pre-formatted, e.g. "2:00 PM"
  checkIn?: string;
  checkOut?: string;
  staffName?: string | null;
  notes?: string | null;
  location?: string | null; // store address/city, e.g. "Lagos, Nigeria"
  paymentReference?: string | null;
  recipientName?: string | null;
};

export type BookingStoreBranding = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null; // from store.themeColors.primary
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * Sends a fully-branded booking confirmation email.
 *
 * Unlike the generic sendOrderNotificationEmail (a single short sentence),
 * this renders a proper receipt-style layout: service, date/time or stay
 * range, assigned staff, price, location, payment reference, and a
 * "manage booking" link — all inside a shell that uses the STORE's own
 * branding (logo, name, color) rather than the hardcoded BizNest identity,
 * so the email reads as coming from the business the customer booked with.
 */
export async function sendBookingConfirmationEmail(
  email: string,
  store: BookingStoreBranding,
  booking: BookingConfirmationDetails
) {
  const manageUrl = `${APP_URL}/store/${store.slug}/account/bookings`;
  const isStay = Boolean(booking.checkIn && booking.checkOut);
  const statusLabel = booking.status === "CONFIRMED" ? "Confirmed" : "Pending";
  const statusColor = booking.status === "CONFIRMED" ? "#0f6410" : "#b45309";
  const statusBg = booking.status === "CONFIRMED" ? "#ecfdf3" : "#fffbeb";
  const subject = `Booking ${statusLabel.toLowerCase()} — ${store.name}`;
  const fmtPrice = `${booking.currency} ${booking.price.toLocaleString()}`;
  const greetingName = booking.recipientName ? escapeHtml(booking.recipientName) : "there";

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;width:38%;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#111827;font-size:13px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  const rows = [
    detailRow("Service", escapeHtml(booking.serviceName)),
    isStay
      ? detailRow("Check-in", escapeHtml(booking.checkIn!))
      : detailRow("Date", escapeHtml(booking.date ?? "")),
    isStay
      ? detailRow("Check-out", escapeHtml(booking.checkOut!))
      : detailRow("Time", escapeHtml(booking.time ?? "")),
    booking.staffName ? detailRow("Specialist", escapeHtml(booking.staffName)) : "",
    detailRow("Price", fmtPrice),
    booking.location ? detailRow("Location", escapeHtml(booking.location)) : "",
    detailRow("Booking reference", escapeHtml(booking.bookingId)),
    booking.paymentReference ? detailRow("Payment reference", escapeHtml(booking.paymentReference)) : "",
  ]
    .filter(Boolean)
    .join("");

  const brand: StoreEmailBrand = {
    name: store.name,
    logoUrl: store.logoUrl,
    color: store.primaryColor,
    contactEmail: store.contactEmail,
    contactPhone: store.contactPhone,
  };

  const html = emailShell({
    preheader: subject,
    ...brandShellOpts(brand),
    body: `
      <p style="margin:0 0 6px;color:#111827;font-size:16px;line-height:24px;">Hi ${greetingName},</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:24px;">
        Your booking with <strong>${escapeHtml(store.name)}</strong> is
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${statusBg};color:${statusColor};font-size:12px;font-weight:700;">${statusLabel}</span>.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        ${rows}
      </table>

      ${
        booking.notes
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
              <tr><td style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:4px;">Notes</td></tr>
              <tr><td style="color:#374151;font-size:13px;line-height:20px;">${escapeHtml(booking.notes)}</td></tr>
            </table>`
          : ""
      }

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${store.primaryColor ?? "#0f6410"};">
            <a href="${manageUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              Manage your booking
            </a>
          </td>
        </tr>
      </table>

      ${
        store.contactEmail || store.contactPhone
          ? `<p style="margin:20px 0 0;color:#9ca3af;font-size:12px;line-height:18px;text-align:center;">
              Questions? Contact ${escapeHtml(store.name)}
              ${store.contactEmail ? `at <a href="mailto:${store.contactEmail}" style="color:#0f6410;text-decoration:none;">${escapeHtml(store.contactEmail)}</a>` : ""}
              ${store.contactPhone ? ` or ${escapeHtml(store.contactPhone)}` : ""}
            </p>`
          : ""
      }
    `,
    footer: `This email was sent to ${email} regarding a booking made with ${escapeHtml(store.name)}.`,
  });

  return send(
    { from: fromFor(brand), reply_to: brand.contactEmail ?? undefined, to: email, subject, html },
    { kind: "booking-confirmation", to: email }
  );
}

/**
 * Sends a fully-rendered HTML email (already built by renderMarketingEmail,
 * e.g. by the automation engine) as-is, under the store's own name — unlike
 * sendOrderNotificationEmail, which wraps a short message in the standard shell.
 */
export async function sendBrandedHtmlEmail(email: string, subject: string, html: string, fromName: string) {
  return send(
    { from: `${safeFromName(fromName)} <${FROM_ADDRESS}>`, to: email, subject, html },
    { kind: "branded-html", to: email }
  );
}

/**
 * Generic transactional notification email — quotes, invoices, recovery codes,
 * low-stock alerts, and anything else that needs a subject line and an HTML
 * message body inside the standard shell.
 *
 * Pass `sender` (a StoreEmailBrand, or just the store's name) whenever the
 * recipient is the store's own customer: the email then carries the store's
 * name, logo, colour and contact details and never mentions BizNest. Leave it
 * unset only for platform-to-merchant notifications (new booking paid, contact
 * enquiries, low-stock alerts), which are legitimately from BizNest.
 */
export async function sendOrderNotificationEmail(
  email: string,
  subject: string,
  messageHtml: string,
  sender?: string | StoreEmailBrand
) {
  const brand: StoreEmailBrand | undefined = typeof sender === "string" ? { name: sender } : sender;
  const html = emailShell({
    preheader: subject,
    ...(brand ? brandShellOpts(brand) : {}),
    body: `
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        ${messageHtml}
      </p>
    `,
    footer: brand ? `This email was sent to ${email} by ${escapeHtml(brand.name)}.` : `This email was sent to ${email} by BizNest.`,
  });

  return send(
    { from: fromFor(brand), reply_to: brand?.contactEmail ?? undefined, to: email, subject, html },
    { kind: "order-notification", to: email }
  );
}

/**
 * Merchant marketing email. Unlike platform transactional mail, this renderer
 * is built from the store's own visual identity and includes a per-recipient
 * unsubscribe link. The campaign action only supplies addresses that have
 * explicitly opted into the store newsletter.
 */
export async function sendMarketingEmail(params: {
  slug: string;
  email: string;
  subject: string;
  input: import("@/lib/actions/marketing").MarketingSendInput;
  brand: import("@/lib/email/marketing-templates").MarketingBrand;
}) {
  const { renderMarketingEmail } = await import("@/lib/email/marketing-templates");
  const { createUnsubscribeToken } = await import("@/lib/email/unsubscribe-token");

  const token = createUnsubscribeToken(params.brand.storeId, params.email);
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
  // One-click endpoint for mailbox providers' built-in unsubscribe button
  // (RFC 8058) — separate from the human-facing confirm page above, since
  // this one must act immediately on a bare POST with no confirmation.
  const oneClickUrl = `${APP_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  // The stored campaign input carries every editable field (highlights, offer/event
  // details, style overrides…), so hand the whole thing to the renderer, which
  // normalises it, rather than picking fields one by one.
  const html = renderMarketingEmail(params.input.template, params.brand, params.input, { unsubscribeUrl });

  const result = await send(
    {
      from: `${params.brand.name} <${FROM_ADDRESS}>`,
      to: params.email,
      reply_to: params.brand.contactEmail ?? undefined,
      subject: params.subject,
      html,
      headers: {
        "List-Unsubscribe": `<${oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    },
    { kind: "marketing-campaign", to: params.email }
  );

  if (result.error) return { success: false, error: result.error.message };
  return { success: true };
}

/**
 * "You left something in your cart" email, sent AS the store the customer was
 * shopping with: store name in the From line and subject, the store's logo and
 * colour in the template, replies going to the store's own contact address.
 */
export async function sendAbandonedCheckoutEmail(params: Omit<AbandonedCheckoutEmailInput, "appUrl">) {
  const html = renderAbandonedCheckoutEmail({ ...params, appUrl: APP_URL });
  return send(
    {
      from: `${safeFromName(params.store.name)} <${FROM_ADDRESS}>`,
      to: params.recipientEmail,
      reply_to: params.store.contactEmail ?? undefined,
      subject: abandonedCheckoutSubject(params.store.name),
      html,
    },
    { kind: "abandoned-checkout", to: params.recipientEmail }
  );
}
