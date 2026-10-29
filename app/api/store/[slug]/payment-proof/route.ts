import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/observability/log";
import { notifyUser } from "@/lib/notifications/notify";
import { formatNumber } from "@/lib/i18n/locale";
import { PROOF_ALLOWED_TYPES, PROOF_MAX_BYTES } from "@/lib/payments/manual-transfer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** The first bytes of the file must match the declared image type (a renamed .exe is not a screenshot). */
function looksLikeImage(buf: Buffer, type: string): boolean {
  if (type === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

/**
 * POST /api/store/<slug>/payment-proof  (multipart: orderId, file, note?)
 * A customer attaches a screenshot of their bank transfer to their own
 * pending bank-transfer order. They can replace it until the vendor confirms.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const session = (await getStoreCustomerSessionForStore(slug)) ?? (await auth());
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to upload your payment proof." }, { status: 401 });

  const rate = await checkRateLimit(`payment-proof:${session.user.id}`, 10, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a few minutes and try again." },
      { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload couldn't be read. Try a smaller image." }, { status: 400 });
  }
  const orderId = String(form.get("orderId") ?? "");
  const file = form.get("file");
  const noteRaw = String(form.get("note") ?? "").trim().slice(0, 300);

  if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image of your payment first." }, { status: 400 });
  if (!(PROOF_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) return NextResponse.json({ error: "That image is too large (4MB max)." }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerId: session.user.id, store: { slug } },
    select: {
      id: true, status: true, paymentProvider: true, total: true, currency: true, storeId: true,
      store: { select: { name: true, slug: true, business: { select: { userId: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.paymentProvider !== "CASH") return NextResponse.json({ error: "This order isn't paid by bank transfer." }, { status: 400 });
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: order.status === "CANCELLED" ? "This order was cancelled." : "This order is already confirmed." }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buffer, file.type)) return NextResponse.json({ error: "That file isn't a valid image." }, { status: 400 });

  let url: string;
  try {
    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `biznest/payment-proofs/${order.storeId}`, resource_type: "image" },
        (error, result) => (error || !result ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });
    url = uploaded.secure_url;
  } catch (err) {
    void logError("STORAGE", "Payment proof upload failed", { orderId, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "We couldn't upload that image. Please try again." }, { status: 502 });
  }

  // Only a still-pending order can take proof; the guard in the WHERE makes a racing confirm win cleanly.
  const updated = await prisma.order.updateMany({
    where: { id: order.id, status: "PENDING_PAYMENT", paymentProvider: "CASH" },
    data: { paymentProofUrl: url, paymentProofAt: new Date(), paymentProofNote: noteRaw || null },
  });
  if (updated.count === 0) return NextResponse.json({ error: "This order was already confirmed." }, { status: 409 });

  await notifyUser({
    userId: order.store.business.userId,
    type: "PAYMENT_PROOF",
    title: "Payment proof received",
    body: `A customer uploaded proof of a ${order.currency} ${formatNumber(Number(order.total))} transfer on ${order.store.name}. Confirm it once the money is in your account.`,
    url: `/store/${order.store.slug}/admin/orders/${order.id}`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, url });
}
