import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmationPath } from "@/lib/payments/confirm-destination";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/<slug>/payment-status?reference=<ref>  |  ?orderId=<id>
 * Polled by the bank-transfer pay page so the customer is moved on the moment
 * the vendor confirms. Reveals only whether it is paid and where to go next.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const orderId = url.searchParams.get("orderId");
  if (!reference && !orderId) return NextResponse.json({ error: "Missing payment." }, { status: 400 });

  const payment = await prisma.payment.findFirst({
    where: { provider: "CASH", store: { slug }, ...(reference ? { reference } : { orderId: orderId!, purpose: "ORDER" }) },
    select: { status: true, purpose: true, orderId: true, bookingId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const paid = payment.status === "SUCCESSFUL";
  return NextResponse.json(
    { paid, status: payment.status, redirectUrl: paid ? confirmationPath(slug, payment) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
