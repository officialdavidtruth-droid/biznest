import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

/**
 * Renders a simple, clean PDF for an invoice on the fly. Deliberately not
 * cached to disk/blob storage in v1 — invoices are small and cheap to
 * regenerate, and this avoids adding a storage dependency just for this.
 * Invoice.pdfUrl (set by generateInvoicePdf) always points back here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, store: true, customer: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;
  const right = 545;

  const draw = (text: string, x: number, size: number, useBold = false, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color });
  };

  draw("BIZNEST INVOICE", left, 22, true);
  y -= 14;
  draw(invoice.invoiceNo, left, 11, false, rgb(0.4, 0.4, 0.4));
  y -= 30;

  draw(invoice.store.name, left, 12, true);
  y -= 16;
  draw(`Customer: ${invoice.customerName ?? invoice.customer?.name ?? "—"}`, left, 10);
  y -= 14;
  if (invoice.customerEmail ?? invoice.customer?.email) {
    draw(`Email: ${invoice.customerEmail ?? invoice.customer?.email}`, left, 10);
    y -= 14;
  }
  draw(`Date: ${invoice.createdAt.toLocaleDateString()}`, left, 10);
  y -= 14;
  draw(`Status: ${invoice.status}`, left, 10);
  y -= 30;

  // Table header
  draw("Description", left, 10, true);
  draw("Qty", 380, 10, true);
  draw("Unit price", 440, 10, true);
  draw("Amount", 500, 10, true);
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 16;

  for (const item of invoice.items) {
    const amount = Number(item.unitPrice) * item.quantity;
    draw(item.description.slice(0, 48), left, 10);
    draw(String(item.quantity), 380, 10);
    draw(Number(item.unitPrice).toLocaleString(), 440, 10);
    draw(amount.toLocaleString(), 500, 10);
    y -= 18;
    if (y < 120) break; // simple v1: no multi-page overflow yet
  }

  y -= 10;
  page.drawLine({ start: { x: 380, y }, end: { x: right, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 18;

  const totalsLine = (label: string, value: number, useBold = false) => {
    draw(label, 380, 10, useBold);
    draw(`${invoice.currency} ${value.toLocaleString()}`, 480, 10, useBold);
    y -= 16;
  };

  totalsLine("Subtotal", Number(invoice.subtotal));
  if (Number(invoice.tax) > 0) totalsLine("Tax", Number(invoice.tax));
  if (Number(invoice.discount) > 0) totalsLine("Discount", -Number(invoice.discount));
  if (Number(invoice.deliveryFee) > 0) totalsLine("Delivery", Number(invoice.deliveryFee));
  totalsLine("Total", Number(invoice.total), true);

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNo}.pdf"`,
    },
  });
}
