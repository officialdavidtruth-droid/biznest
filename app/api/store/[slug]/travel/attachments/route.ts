import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";
import { travelRouteAccess } from "@/lib/travel-access";
import {
  ATTACHMENT_ALLOWED_TYPES, ATTACHMENT_KINDS, ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPE_HINT, MAX_ATTACHMENTS_PER_PARENT,
  cleanFileName, sniffFileType, travelFolderFor,
} from "@/lib/travel-files";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Staff upload of a private file to a trip (form field tripId) or a visa case (visaCaseId).
 * Optional: kind, travelerId (a traveller on that trip), note. The parent must belong to this store.
 */
export const POST = withObservability("travel-attachment-upload", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const gate = await travelRouteAccess(slug);
  if (!gate.ok) return gate.res;
  const session = await auth();
  const storeId = gate.store.id;

  const rate = await checkRateLimit(`travel-file:${session?.user?.id ?? storeId}`, 40, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many uploads. Please wait a bit." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ATTACHMENT_ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `Unsupported file type. Use ${ATTACHMENT_TYPE_HINT}.` }, { status: 400 });
  if (file.size > ATTACHMENT_MAX_BYTES) return NextResponse.json({ error: "File must be 4MB or smaller." }, { status: 400 });

  const tripId = String(form.get("tripId") ?? "");
  const visaCaseId = String(form.get("visaCaseId") ?? "");
  if (!!tripId === !!visaCaseId) return NextResponse.json({ error: "Attach to a trip or a visa case." }, { status: 400 });

  // storeId in each where clause is the tenant check: an id from another store looks like "not found".
  let travelerId: string | null = null;
  if (tripId) {
    const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId }, select: { id: true } });
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    const tid = String(form.get("travelerId") ?? "");
    if (tid) {
      const t = await prisma.travelTraveler.findFirst({ where: { id: tid, tripId: trip.id }, select: { id: true } });
      if (!t) return NextResponse.json({ error: "Traveller not found on this trip." }, { status: 404 });
      travelerId = t.id;
    }
  } else {
    const vc = await prisma.travelVisaCase.findFirst({ where: { id: visaCaseId, storeId }, select: { id: true } });
    if (!vc) return NextResponse.json({ error: "Visa case not found." }, { status: 404 });
  }
  const count = await prisma.travelAttachment.count({ where: { storeId, ...(tripId ? { tripId } : { visaCaseId }) } });
  if (count >= MAX_ATTACHMENTS_PER_PARENT) return NextResponse.json({ error: `A file can hold at most ${MAX_ATTACHMENTS_PER_PARENT} attachments.` }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (sniffFileType(buffer) !== file.type) return NextResponse.json({ error: "That file's contents don't match its type." }, { status: 400 });

  const kindRaw = String(form.get("kind") ?? "OTHER");
  const kind = (ATTACHMENT_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "OTHER";
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || null;

  try {
    const result = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: travelFolderFor(storeId), resource_type: "raw", type: "authenticated", use_filename: false, unique_filename: true },
        (error, uploaded) => (error || !uploaded ? reject(error ?? new Error("Upload failed.")) : resolve(uploaded)),
      );
      stream.end(buffer);
    });
    const row = await prisma.travelAttachment.create({
      data: { storeId, tripId: tripId || null, visaCaseId: visaCaseId || null, travelerId, kind, fileName: cleanFileName(file.name), mimeType: file.type, sizeBytes: file.size, publicId: result.public_id, note, uploadedByEmail: session?.user?.email ?? null },
      select: { id: true },
    });
    return NextResponse.json({ id: row.id });
  } catch (err) {
    void logError("STORAGE", "Travel attachment upload failed", { storeId, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "We couldn't upload that file. Please try again." }, { status: 502 });
  }
});
