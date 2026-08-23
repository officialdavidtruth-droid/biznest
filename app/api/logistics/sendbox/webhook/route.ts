import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Sendbox Logistics webhook
 *
 * Configure in Sendbox:
 * https://your-domain.com/api/logistics/sendbox/webhook
 *
 * The handler accepts common Sendbox shipment/order identifiers and
 * status fields so the integration remains tolerant of payload variations.
 */

function verifySignature(rawBody: string, req: Request): boolean {
  const secret = process.env.SENDBOX_WEBHOOK_SECRET;

  // If no secret has been configured, allow the webhook.
  // Once Sendbox provides a signing secret, add it to .env and
  // requests will be verified automatically.
  if (!secret) return true;

  const signature =
    req.headers.get("x-sendbox-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-signature");

  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const supplied = signature.replace(/^sha256=/i, "").trim();

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(supplied)
    );
  } catch {
    return false;
  }
}

function getValue(obj: any, paths: string[]): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let value = obj;

    for (const part of parts) {
      if (value == null) break;
      value = value[part];
    }

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function mapSendboxStatus(status: string) {
  switch (status) {
    case "delivered":
    case "delivery_completed":
    case "completed":
      return "DELIVERED" as const;

    case "cancelled":
    case "canceled":
    case "delivery_cancelled":
    case "shipment_cancelled":
      return "CANCELLED" as const;

    case "picked_up":
    case "pickup":
    case "in_transit":
    case "out_for_delivery":
    case "dispatched":
    case "shipped":
    case "assigned":
    case "processing":
      return "IN_PROGRESS" as const;

    default:
      return null;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req)) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  /*
   * Sendbox may place the event information at the root or inside
   * data/shipment/order depending on the webhook event.
   */
  const status = normalizeStatus(
    getValue(payload, [
      "status",
      "event",
      "event_type",
      "eventType",
      "data.status",
      "data.event",
      "data.event_type",
      "shipment.status",
      "shipment.event",
      "order.status",
    ])
  );

  const orderId = String(
    getValue(payload, [
      "orderId",
      "order_id",
      "reference",
      "order_reference",
      "merchant_reference",
      "data.orderId",
      "data.order_id",
      "data.reference",
      "data.order_reference",
      "shipment.orderId",
      "shipment.order_id",
      "shipment.reference",
      "order.id",
      "order.reference",
    ]) ?? ""
  ).trim();

  const trackingNumber = getValue(payload, [
    "trackingNumber",
    "tracking_number",
    "trackingCode",
    "tracking_code",
    "waybill",
    "waybill_number",
    "data.trackingNumber",
    "data.tracking_number",
    "data.trackingCode",
    "data.tracking_code",
    "data.waybill",
    "shipment.trackingNumber",
    "shipment.tracking_number",
    "shipment.waybill",
  ]);

  console.log("[Sendbox webhook]", {
    status,
    orderId,
    trackingNumber,
  });

  if (!orderId) {
    // Acknowledge unrelated Sendbox events rather than making Sendbox
    // repeatedly retry them.
    return NextResponse.json({
      received: true,
      processed: false,
      reason: "No BizNest order identifier found",
    });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: "Order not found",
    });
  }

  const newStatus = mapSendboxStatus(status);

  if (!newStatus || newStatus === order.status) {
    return NextResponse.json({
      received: true,
      processed: false,
      orderId: order.id,
      status,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: newStatus,
        note: trackingNumber
          ? `Sendbox delivery update: ${status}. Tracking: ${trackingNumber}`
          : `Sendbox delivery update: ${status}`,
      },
    });
  });

  return NextResponse.json({
    received: true,
    processed: true,
    orderId: order.id,
    status: newStatus,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "BizNest Sendbox webhook",
  });
}
