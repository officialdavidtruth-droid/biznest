import { Resend } from "resend";
import { logError } from "@/lib/observability/log";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "BizNest <no-reply@biznest.space>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

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
function emailShell(opts: { preheader?: string; body: string; footer: string }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#0b6413;padding:18px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <img
                        src="${APP_URL}/email-logo.png"
                        alt="BizNest"
                        width="70"
                        height="32"
                        style="display:block;height:32px;width:70px;border:0;outline:none;"
                      />
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
            <tr>
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
            </tr>
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

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;

  const html = emailShell({
    preheader: "Confirm your email to get started on BizNest",
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Welcome to BizNest 👋</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        Confirm your email address to finish setting up your account and get started.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:#0f6410;">
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
        <a href="${url}" style="color:#0f6410;font-size:13px;text-decoration:underline;">${url}</a>
      </p>

      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;">
        This link expires in 24 hours.
      </p>
    `,
    footer: `This email was sent to ${email} because an account was created with this address on BizNest.
      If you didn't do this, you can safely ignore this email.`,
  });

  return send(
    {
      from: FROM,
      to: email,
      subject: "Verify your BizNest email",
      html,
    },
    { kind: "verification", to: email }
  );
}

export async function sendPasswordResetEmail(email: string, token: string, storeSlug?: string) {
  const url = `${APP_URL}/reset-password?token=${token}${storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : ""}`;

  const html = emailShell({
    preheader: "Reset your BizNest password",
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">Reset your password</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:24px;">
        We received a request to reset the password for your BizNest account. Click the button below to
        choose a new one.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:#0f6410;">
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
        <a href="${url}" style="color:#0f6410;font-size:13px;text-decoration:underline;">${url}</a>
      </p>

      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `,
    footer: `This email was sent to ${email} because a password reset was requested for this BizNest account.`,
  });

  return send(
    {
      from: FROM,
      to: email,
      subject: "Reset your BizNest password",
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

export async function sendOrderNotificationEmail(
  email: string,
  subject: string,
  message: string
) {
  const html = emailShell({
    preheader: subject,
    body: `
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:24px;">${subject}</p>
      <p style="margin:0;color:#374151;font-size:15px;line-height:24px;">${message}</p>
    `,
    footer: `This email was sent to ${email} regarding an order on BizNest.`,
  });

  return send({ from: FROM, to: email, subject, html }, { kind: "order-notification", to: email });
}
