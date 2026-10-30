import crypto from "crypto";
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

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf", "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt", "text/csv": "csv",
};

/** The first bytes of the file must match its declared type (a renamed .exe is not a receipt). */
function looksLikeProof(buf: Buffer, type: string): boolean {
  const head = (n: number) => buf.subarray(0, n);
  switch (type) {
    case "image/jpeg": return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png": return buf.length > 8 && head(8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp": return buf.length > 12 && head(4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
    case "image/gif": return buf.length > 6 && ["GIF87a", "GIF89a"].includes(head(6).toString("ascii"));
    case "application/pdf": return buf.length > 5 && buf.subarray(0, 1024).includes("%PDF-");
    case "application/msword":
    case "application/vnd.ms-excel": return buf.length > 8 && head(8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
    case "text/plain":
    case "text/csv": return !buf.subarray(0, 4096).includes(0); // text has no NUL bytes
    default: return false;
  }
}

/** Uploads the proof to Cloudinary: images as images, documents as raw files that keep their extension. */
function uploadProof(buffer: Buffer, type: string, folder: string): Promise<string> {
  const isImage = type.startsWith("image/");
  const publicId = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${isImage ? "" : `.${EXT_BY_TYPE[type]}`}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: isImage ? "image" : "raw" },
      (error, result) => (error || !result ? reject(error) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

/**
 * POST /api/store/<slug>/payment-proof  (multipart: orderId, file, note?)
 * A customer attaches proof of their bank transfer (image or document) to their own
 * pending bank-transfer order. They can replace it until the vendor confirms.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Invoices, quote deposits, bookings and PMS deposits identify the payment by its (unguessable) reference.
  const paymentReference = new URL(req.url).searchParams.get("reference") ?? "";
  if (paymentReference) return uploadTransferProof(req, slug, paymentReference);

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
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose your proof of payment first." }, { status: 400 });
  if (!(PROOF_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Upload an image or a document (PDF, Word, Excel, text)." }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) return NextResponse.json({ error: "That file is too large (4MB max)." }, { status: 400 });

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
  if (!looksLikeProof(buffer, file.type)) return NextResponse.json({ error: "That file doesn't look like a valid image or document." }, { status: 400 });

  let url: string;
  try {
    url = await uploadProof(buffer, file.type, `biznest/payment-proofs/${order.storeId}`);
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


/**
 * Proof for a non-order bank-transfer payment. The pay page is a capability
 * link (the reference is random), so a guest holding an invoice link can upload
 * without an account; abuse is bounded by an IP rate limit and by the payment
 * having to be an open, pending transfer for this store.
 */
async function uploadTransferProof(req: Request, slug: string, reference: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`payment-proof-ref:${ip}`, 10, 10 * 60 * 1000);
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
  const file = form.get("file");
  const noteRaw = String(form.get("note") ?? "").trim().slice(0, 300);
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose your proof of payment first." }, { status: 400 });
  if (!(PROOF_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Upload an image or a document (PDF, Word, Excel, text)." }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) return NextResponse.json({ error: "That file is too large (4MB max)." }, { status: 400 });

  const payment = await prisma.payment.findFirst({
    where: { reference, provider: "CASH", purpose: { not: "ORDER" }, store: { slug } },
    select: {
      id: true, status: true, amount: true, currency: true, storeId: true,
      store: { select: { name: true, slug: true, business: { select: { userId: true } } } },
    },
  });
  if (!payment || !payment.storeId || !payment.store) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: payment.status === "SUCCESSFUL" ? "This payment is already confirmed." : "This payment is no longer open." }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeProof(buffer, file.type)) return NextResponse.json({ error: "That file doesn't look like a valid image or document." }, { status: 400 });

  let url: string;
  try {
    url = await uploadProof(buffer, file.type, `biznest/payment-proofs/${payment.storeId}`);
  } catch (err) {
    void logError("STORAGE", "Payment proof upload failed", { reference, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "We couldn't upload that image. Please try again." }, { status: 502 });
  }

  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING", provider: "CASH" },
    data: { proofUrl: url, proofAt: new Date(), proofNote: noteRaw || null },
  });
  if (updated.count === 0) return NextResponse.json({ error: "This payment was already confirmed." }, { status: 409 });

  await notifyUser({
    userId: payment.store.business.userId,
    type: "PAYMENT_PROOF",
    title: "Payment proof received",
    body: `A customer uploaded proof of a ${payment.currency} ${formatNumber(Number(payment.amount))} transfer on ${payment.store.name}. Confirm it once the money is in your account.`,
    url: `/store/${payment.store.slug}/admin/payments`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, url });
}
