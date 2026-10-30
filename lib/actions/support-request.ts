"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { sendSupportRequestEmail } from "@/lib/email/send";
import { SUPPORT_EMAIL } from "@/lib/constants/support";
import { logError } from "@/lib/observability/log";
import type { ActionResult } from "@/types/actions";

const MAX_MESSAGE = 2000;
const MAX_TRANSCRIPT = 8000;
const LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

/**
 * Sends the merchant's help chat to the BizNest team. Saves a SupportRequest
 * (so nothing is lost if email fails) and emails the support inbox with the
 * store and user attached, Reply-To set to the merchant.
 */
export async function submitSupportRequest(
  slug: string,
  message: string,
  transcript: string
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const note = String(message ?? "").trim().slice(0, MAX_MESSAGE);
  if (note.length < 5) return { success: false, error: "Please describe your problem in a few words." };
  const chat = String(transcript ?? "").trim().slice(-MAX_TRANSCRIPT);

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (role === null) return { success: false, error: "You don't have access to this store." };

  const limit = await checkRateLimit(`support-request:${session.user.id}`, LIMIT.max, LIMIT.windowMs);
  if (!limit.allowed) return { success: false, error: "You've sent several requests already. Please wait a while before sending another." };

  const request = await prisma.supportRequest.create({
    data: {
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      message: note,
      transcript: chat,
    },
  });

  try {
    const res = await sendSupportRequestEmail({
      to: SUPPORT_EMAIL,
      requestId: request.id,
      storeName: store.name,
      storeSlug: store.slug,
      userName: request.userName,
      userEmail: request.userEmail,
      message: note,
      transcript: chat,
    });
    if (!res.error) await prisma.supportRequest.update({ where: { id: request.id }, data: { emailSent: true } });
  } catch (err) {
    void logError("EMAIL", "Support request email failed", { id: request.id, error: err instanceof Error ? err.message : String(err) });
  }

  // The request is saved either way, so the merchant is never told it failed because email did.
  return { success: true, data: { id: request.id } };
}
