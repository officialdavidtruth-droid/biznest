"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import { notifyUser } from "@/lib/notifications/notify";
import { logError } from "@/lib/observability/log";
import { startTailoringCharge } from "@/lib/payments/tailoring-charge";
import {
  TAILORING_MIN_ONLINE_PAYMENT, isTailoringPhotoUrl, isTailoringToken, tailoringBalance,
  type TailoringPhoto,
} from "@/lib/tailoring";
import type { ActionResult } from "@/types/actions";

// Public (no sign-in) entry points for tailoring customers. Everything here is rate limited and re-validated on
// the server; the client is never trusted for who the job belongs to or how much is owed.

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}

/**
 * The customer pays toward their balance from the status page. Authorised by the job's unguessable tracking
 * token. The amount is capped at what is actually owed (recomputed here) and defaults to the full balance.
 */
export async function startTailoringBalancePayment(slug: string, token: string, requested?: number): Promise<ActionResult<{ url: string }>> {
  if (!isTailoringToken(token)) return { success: false, error: "This link isn't valid." };
  const ip = await callerIp();
  const [byIp, byToken] = await Promise.all([
    checkRateLimit(`tailoring-pay:ip:${ip}`, 20, 60 * 60 * 1000),
    checkRateLimit(`tailoring-pay:job:${token}`, 10, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byToken.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, currency: true, customDomain: true, customDomainStatus: true } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This store isn't taking payments right now." };
  const job = await prisma.tailoringJob.findUnique({ where: { trackingToken: token }, select: { id: true, storeId: true, customerName: true, price: true, amountPaid: true } });
  if (!job || job.storeId !== store.id) return { success: false, error: "This link isn't valid." };

  const balance = tailoringBalance(job.price == null ? null : Number(job.price), Number(job.amountPaid));
  if (balance == null) return { success: false, error: `${store.name} hasn't set the price yet.` };
  if (balance <= 0) return { success: false, error: "This job is already paid in full." };

  let amount = requested == null || requested === 0 ? balance : Math.round(Number(requested) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount." };
  if (amount > balance + 0.009) return { success: false, error: "That's more than the balance owed." };
  amount = Math.min(amount, balance);
  const floor = Math.min(TAILORING_MIN_ONLINE_PAYMENT, balance);
  if (amount < floor) return { success: false, error: `The smallest payment is ${floor}.` };

  const r = await startTailoringCharge({ store, jobId: job.id, amount, currency: store.currency, customerName: job.customerName });
  return r.success ? { success: true, data: { url: r.url } } : { success: false, error: r.error };
}

/** The storefront order form. Creates a request for the tailor to review: nothing is charged and no job exists yet. */
export async function submitTailoringRequest(slug: string, form: FormData): Promise<ActionResult<{ name: string }>> {
  // Honeypot: real people never see or fill this field.
  if (String(form.get("website") || "").trim()) return { success: true, data: { name: "" } };

  const str = (k: string, max: number) => String(form.get(k) || "").trim().slice(0, max);
  const customerName = str("customerName", 80), garmentType = str("garmentType", 80);
  const customerPhone = str("customerPhone", 30);
  const customerEmail = str("customerEmail", 120) || null;
  const details = str("details", 2000) || null;
  if (!customerName || !garmentType) return { success: false, error: "Please enter your name and what you'd like made." };
  if (!normalizeWhatsAppNumber(customerPhone)) return { success: false, error: "Enter a phone number the tailor can reach you on." };
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return { success: false, error: "That email address doesn't look right." };

  const neededRaw = str("neededBy", 20);
  let neededBy: Date | null = null;
  if (neededRaw) {
    neededBy = new Date(neededRaw);
    if (Number.isNaN(neededBy.getTime())) return { success: false, error: "Enter a valid date." };
    if (neededBy.getTime() < Date.now() - 24 * 60 * 60 * 1000) return { success: false, error: "The date you need it by is in the past." };
  }

  let urls: unknown = [];
  try { urls = JSON.parse(String(form.get("photos") || "[]")); } catch { /* ignore malformed */ }
  const photos: TailoringPhoto[] = (Array.isArray(urls) ? urls : []).filter(isTailoringPhotoUrl).slice(0, 4).map((url) => ({ url, kind: "reference" as const, at: new Date().toISOString() }));

  const ip = await callerIp();
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, business: { select: { user: { select: { id: true } } } } } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This business isn't taking orders right now." };
  const [byIp, byStore] = await Promise.all([
    checkRateLimit(`tailoring-request:ip:${ip}`, 5, 60 * 60 * 1000),
    checkRateLimit(`tailoring-request:store:${store.id}`, 60, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byStore.allowed) return { success: false, error: "Too many requests right now. Please try again later." };

  const req = await prisma.tailoringRequest.create({
    data: { storeId: store.id, customerName, customerPhone, customerEmail, garmentType, details, neededBy, photos: photos.length ? (photos as never) : undefined },
  });

  const ownerId = store.business?.user?.id;
  if (ownerId) {
    try {
      await notifyUser({ userId: ownerId, type: "TAILORING_REQUEST", title: `New order request from ${customerName}`, body: `${garmentType}${neededBy ? ` · needed by ${neededBy.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}`, url: `/store/${store.slug}/admin/fashion` });
    } catch (err) {
      void logError("MESSAGING", "Could not notify store of tailoring request", { requestId: req.id, error: String(err) });
    }
  }
  return { success: true, data: { name: store.name } };
}
