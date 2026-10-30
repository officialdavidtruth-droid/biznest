import { NextResponse } from "next/server";
import { getOrderForBuyer } from "@/lib/actions/order";
import { parsePrivateRef, signedPrivateUrl } from "@/lib/digital-files";

// Only orders that are actually paid (and not refunded/disputed/cancelled) unlock files.
const DOWNLOADABLE = new Set(["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"]);

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; orderId: string; itemId: string }> }) {
  const { slug, orderId, itemId } = await params;

  // getOrderForBuyer only returns the order to the logged-in buyer who placed it, in this store.
  const order = await getOrderForBuyer(orderId, slug);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!DOWNLOADABLE.has(String(order.status))) return NextResponse.json({ error: "This order is not paid." }, { status: 403 });

  const item = order.items.find((i: any) => i.id === itemId);
  const product = item?.product;
  if (!item || !product || product.type !== "DIGITAL" || !product.digitalFileUrl) {
    return NextResponse.json({ error: "No file for this item." }, { status: 404 });
  }

  const publicId = parsePrivateRef(product.digitalFileUrl);
  // Legacy public URL: nothing to sign, send the buyer to it.
  if (!publicId) return NextResponse.redirect(product.digitalFileUrl);

  const upstream = await fetch(signedPrivateUrl(publicId));
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "The file is unavailable right now. Please contact the seller." }, { status: 502 });

  const ext = publicId.includes(".") ? publicId.slice(publicId.lastIndexOf(".")) : "";
  const base = product.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "download";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${base}${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
