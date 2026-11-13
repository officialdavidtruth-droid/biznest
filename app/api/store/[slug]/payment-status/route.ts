import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmationPath } from "@/lib/payments/confirm-destination";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/<slug>/payment-status?reference=<ref>  |  ?orderId=<id>
 * Polled by the bank-transfer pay page so the customer is moved on the moment
 * the vendor confirms. Reveals only whether it is paid and where to go next.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The pay page polls every 5-30s (about 12 a minute at most), so 60/min per visitor per store is generous
  // for real customers (even several behind one network) and stops reference/order-id guessing.
  const rl = await checkRateLimit(`payment-status:${slug}:${getClientIp(req.headers)}`, 60, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60), "Cache-Control": "no-store" } });
  }
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const orderId = url.searchParams.get("orderId");
  if (!reference && !orderId) return NextResponse.json({ error: "Missing payment." }, { status: 400 });

  const payment = await prisma.payment.findFirst({
    where: { provider: "CASH", store: { slug }, ...(reference ? { reference } : { orderId: orderId!, purpose: "ORDER" }) },
    select: { status: true, purpose: true, orderId: true, bookingId: true, order: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const paid = payment.status === "SUCCESSFUL";
  // Nothing more can arrive for a payment that is no longer open (cancelled order, failed/refunded
  // payment), so tell the page to stop polling. A cancelled order can still be confirmed late by the
  // vendor, but the customer is told to contact the store rather than being polled forever.
  const closed = !paid && (payment.status !== "PENDING" || payment.order?.status === "CANCELLED");
  return NextResponse.json(
    { paid, closed, status: payment.status, redirectUrl: paid ? confirmationPath(slug, payment) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
