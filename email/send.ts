import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "BizNest <no-reply@biznest.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your BizNest email",
    html: `<p>Welcome to BizNest. Confirm your email to get started:</p>
           <p><a href="${url}">${url}</a></p>
           <p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your BizNest password",
    html: `<p>We received a request to reset your password.</p>
           <p><a href="${url}">${url}</a></p>
           <p>If you didn't request this, you can ignore this email.</p>`,
  });
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

  return resend.emails.send({ from: FROM, to: email, subject, html: `<p>${body}</p>` });
}

export async function sendOrderNotificationEmail(
  email: string,
  subject: string,
  message: string
) {
  return resend.emails.send({ from: FROM, to: email, subject, html: `<p>${message}</p>` });
}
