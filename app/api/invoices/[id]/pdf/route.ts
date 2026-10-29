import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { verifyDocToken } from "@/lib/documents/share-token";

/**
 * Renders a simple, clean PDF for an invoice on the fly. Deliberately not
 * cached to disk/blob storage in v1 — invoices are small and cheap to
 * regenerate, and this avoids adding a storage dependency just for this.
 * Invoice.pdfUrl (set by generateInvoicePdf) always points back here.
 *
 * Access: the signed share token (?token=), the signed-in customer (by id or by the
 * email the invoice was sent to), or anyone with access to the store.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, store: { include: { business: true } }, customer: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "DRAFT") return NextResponse.json({ error: "Invoice not available" }, { status: 404 });

  let allowed = await verifyDocToken("invoice", id, new URL(req.url).searchParams.get("token"));
  if (!allowed) {
    const session = await auth();
    if (session?.user?.id) {
      if (invoice.customerId === session.user.id) allowed = true;
      const invoiceEmail = (invoice.customerEmail ?? invoice.customer?.email)?.toLowerCase();
      if (!allowed && invoiceEmail && session.user.email?.toLowerCase() === invoiceEmail) allowed = true;
      if (!allowed) {
        const role = await getStoreAccessRole(session.user.id, session.user.role, invoice.store);
        allowed = role !== null;
      }
    }
  }
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // The built-in Helvetica font only covers WinAnsi, and drawText throws on anything else
  // (Yoruba dot-below letters like ẹ/ọ/ṣ, emoji, ...), which used to turn into a 500.
  // Strip marks we can't draw and replace what's left with "?" so the PDF always renders.
  const supported = new Set(font.getCharacterSet());
  const safe = (text: string) => {
    let out = "";
    for (const ch of String(text).normalize("NFC")) {
      const cp = ch.codePointAt(0)!;
      if (cp < 32 || cp === 127) { out += " "; continue; }
      if (cp >= 0x300 && cp <= 0x36f) continue; // stray combining mark
      if (supported.has(cp)) { out += ch; continue; }
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      out += base && [...base].every((c) => supported.has(c.codePointAt(0)!)) ? base : "?";
    }
    return out;
  };

  const left = 50;
  const right = 545;
  const TOP = 800;
  const BOTTOM = 80;
  let page = doc.addPage([595.28, 841.89]); // A4
  let y = TOP;

  const draw = (text: string, x: number, size: number, useBold = false, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(safe(text), { x, y, size, font: useBold ? bold : font, color });
  };

  const tableHeader = () => {
    draw("Description", left, 10, true);
    draw("Qty", 380, 10, true);
    draw("Unit price", 440, 10, true);
    draw("Amount", 500, 10, true);
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 16;
  };

  // Start a fresh page when the next block (height `needed`) wouldn't fit.
  const ensureSpace = (needed: number, repeatHeader = false) => {
    if (y - needed >= BOTTOM) return;
    page = doc.addPage([595.28, 841.89]);
    y = TOP;
    if (repeatHeader) tableHeader();
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
  draw(`Date: ${formatDate(invoice.createdAt)}`, left, 10);
  y -= 14;
  draw(`Status: ${invoice.status}`, left, 10);
  y -= 30;

  tableHeader();

  for (const item of invoice.items) {
    ensureSpace(18, true);
    const amount = Number(item.unitPrice) * item.quantity;
    const description = item.description.length > 48 ? `${item.description.slice(0, 45)}...` : item.description;
    draw(description, left, 10);
    draw(String(item.quantity), 380, 10);
    draw(formatNumber(Number(item.unitPrice)), 440, 10);
    draw(formatNumber(amount), 500, 10);
    y -= 18;
  }

  // Keep the totals block together on one page (5 lines max + the rule above it).
  ensureSpace(130);
  y -= 10;
  page.drawLine({ start: { x: 380, y }, end: { x: right, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 18;

  const totalsLine = (label: string, value: number, useBold = false) => {
    draw(label, 380, 10, useBold);
    draw(`${invoice.currency} ${formatNumber(value)}`, 480, 10, useBold);
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
      "Content-Disposition": `inline; filename="${invoice.invoiceNo.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"`,
    },
  });
}
