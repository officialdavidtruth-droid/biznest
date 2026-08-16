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

export async function sendStaffInviteEmail(
  email: string,
  token: string,
  storeName: string,
  inviterName: string,
  role: "MANAGER" | "STAFF"
) {
  const url = `${APP_URL}/staff/accept?token=${token}`;
  return send(
    {
      from: FROM,
      to: email,
      subject: `${inviterName} invited you to manage ${storeName} on BizNest`,
      html: `<p>${inviterName} added you as a <strong>${role === "MANAGER" ? "Manager" : "Staff member"}</strong> on <strong>${storeName}</strong>'s BizNest dashboard.</p>
           <p><a href="${url}">${url}</a></p>
           <p>If you don't already have a BizNest account with this email, you'll be asked to create one first.</p>`,
    },
    { kind: "staff-invite", to: email }
  );
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  return send(
    {
      from: FROM,
      to: email,
      subject: "Verify your BizNest email",
      html: `<p>Welcome to BizNest. Confirm your email to get started:</p>
           <p><a href="${url}">${url}</a></p>
           <p>This link expires in 24 hours.</p>`,
    },
    { kind: "verification", to: email }
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  return send(
    {
      from: FROM,
      to: email,
      subject: "Reset your BizNest password",
      html: `<p>We received a request to reset your password.</p>
           <p><a href="${url}">${url}</a></p>
           <p>If you didn't request this, you can ignore this email.</p>`,
    },
    { kind: "password-reset", to: email }
  );
}

export async function sendBusinessStatusEmail(
  email: string,
  status: "APPROVED" | "REJECTED",
  reason?: string
) {
  const subject =
    status === "APPROVED" ? "Your BizNest business has been verified" : "Update on your BizNest verification";
  const body =
    status === "APPROVED"
      ? "Congratulations — your business has been verified. You can now create your store."
      : `Your business verification could not be approved.${reason ? ` Reason: ${reason}` : ""} You may correct the details and resubmit.`;

  return send({ from: FROM, to: email, subject, html: `<p>${body}</p>` }, { kind: "business-status", to: email });
}

export async function sendOrderNotificationEmail(
  email: string,
  subject: string,
  message: string
) {
  return send({ from: FROM, to: email, subject, html: `<p>${message}</p>` }, { kind: "order-notification", to: email });
}
