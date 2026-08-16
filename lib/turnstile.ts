/**
 * Server-side verification for Cloudflare Turnstile (bot protection).
 *
 * Flow: the client widget (components/forms/turnstile-widget.tsx) renders a
 * challenge and produces a one-time token, submitted alongside the form as
 * `cf-turnstile-response`. This function re-checks that token against
 * Cloudflare's API — never trust the client-side pass/fail alone, since a
 * bot can just skip rendering the widget and post the form directly.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Fail closed in production if the secret isn't configured — don't let a
  // missing env var silently disable bot protection. Fail open in
  // dev/test so local work isn't blocked before a key is set up.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { success: false, errorCodes: ["missing-secret-key"] };
    }
    return { success: true };
  }

  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Never cache a verification result.
      cache: "no-store",
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { success: data.success, errorCodes: data["error-codes"] };
  } catch {
    // Cloudflare unreachable — fail closed. A bot-protection check that
    // fails open on network error defeats its own purpose.
    return { success: false, errorCodes: ["internal-fetch-error"] };
  }
}
