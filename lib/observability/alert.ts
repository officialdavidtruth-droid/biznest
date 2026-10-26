import { prisma } from "@/lib/prisma";

/**
 * Pushes an alert to the owner. Telegram (instant phone push) and/or email.
 *
 *   ALERT_EMAIL         comma-separated recipients (uses RESEND_API_KEY / EMAIL_FROM)
 *   TELEGRAM_BOT_TOKEN  from @BotFather
 *   TELEGRAM_CHAT_ID    your chat id (see docs/OPERATIONS.md)
 *
 * Throttled per `key` so a flapping failure sends one alert, not hundreds.
 * Deliberately has no dependency on lib/observability/log.ts (log.ts calls
 * this) and never throws: alerting must not be what breaks a request.
 */
export type AlertInput = {
  key: string;
  subject: string;
  body: string;
  /** Minimum minutes between alerts with the same key. Default 60. */
  throttleMinutes?: number;
};

const ALERT_MARKER = "ALERT_SENT";
const memoryThrottle = new Map<string, number>();

export function alertChannelsConfigured(): boolean {
  return Boolean(
    process.env.ALERT_EMAIL || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  );
}

async function recentlySent(key: string, windowMs: number): Promise<boolean> {
  const mem = memoryThrottle.get(key);
  if (mem && Date.now() - mem < Math.min(windowMs, 60_000)) return true;
  try {
    const hit = await prisma.systemEvent.findFirst({
      where: {
        category: "JOBS",
        message: { startsWith: ALERT_MARKER },
        metadata: { path: ["alertKey"], equals: key },
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
      select: { id: true },
    });
    return Boolean(hit);
  } catch {
    // DB unreachable (likely the very thing we're alerting about): fail open.
    return false;
  }
}

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3800), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendEmail(subject: string, text: string): Promise<boolean> {
  const to = (process.env.ALERT_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const apiKey = process.env.RESEND_API_KEY;
  if (!to.length || !apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "BizNest <no-reply@biznest.space>",
        to,
        subject,
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendAlert(input: AlertInput): Promise<boolean> {
  try {
    const windowMs = (input.throttleMinutes ?? 60) * 60_000;
    if (await recentlySent(input.key, windowMs)) return false;
    memoryThrottle.set(input.key, Date.now());

    const lagos = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour12: false });
    const text = `${input.subject}\n\n${input.body}\n\n${lagos} (Lagos)`;

    if (!alertChannelsConfigured()) {
      console.error(`[alert] (no ALERT_EMAIL / TELEGRAM_* configured) ${input.subject}\n${input.body}`);
      return false;
    }

    const [tg, mail] = await Promise.all([sendTelegram(text), sendEmail(input.subject, text)]);
    if (!tg && !mail) console.error("[alert] every channel failed for:", input.subject);

    await prisma.systemEvent
      .create({
        data: {
          category: "JOBS",
          level: "INFO",
          message: `${ALERT_MARKER} ${input.key}`,
          metadata: { alertKey: input.key, telegram: tg, email: mail },
        },
      })
      .catch(() => {});
    return tg || mail;
  } catch (err) {
    console.error("[alert] sendAlert crashed:", err);
    return false;
  }
}
