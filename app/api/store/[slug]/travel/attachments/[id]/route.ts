import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";
import { travelRouteAccess } from "@/lib/travel-access";
import { isStoreTravelFile } from "@/lib/travel-files";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type Ctx = { params: Promise<{ slug: string; id: string }> };

/** Staff-only viewer. The file is found by attachment id in this store (never by a URL from the request) and the browser is sent to a 2-minute signed link. */
export const GET = withObservability("travel-attachment-view", async (_req: Request, context: Ctx) => {
  const { slug, id } = await context.params;
  const gate = await travelRouteAccess(slug);
  if (!gate.ok) return gate.res;
  const att = await prisma.travelAttachment.findFirst({ where: { id, storeId: gate.store.id }, select: { publicId: true } });
  if (!att) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (!isStoreTravelFile(att.publicId, gate.store.id)) return NextResponse.json({ error: "Unsupported file location." }, { status: 422 });
  const url = cloudinary.utils.private_download_url(att.publicId, "", { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 120 });
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  return res;
});

/** Removes the record first (so it disappears even if storage is slow), then deletes the stored file. */
export const DELETE = withObservability("travel-attachment-delete", async (_req: Request, context: Ctx) => {
  const { slug, id } = await context.params;
  const gate = await travelRouteAccess(slug);
  if (!gate.ok) return gate.res;
  const att = await prisma.travelAttachment.findFirst({ where: { id, storeId: gate.store.id }, select: { id: true, publicId: true } });
  if (!att) return NextResponse.json({ error: "File not found." }, { status: 404 });
  await prisma.travelAttachment.delete({ where: { id: att.id } });
  if (isStoreTravelFile(att.publicId, gate.store.id)) {
    try { await cloudinary.uploader.destroy(att.publicId, { resource_type: "raw", type: "authenticated", invalidate: true }); }
    catch (err) { void logError("STORAGE", "Travel attachment delete from storage failed", { storeId: gate.store.id, message: err instanceof Error ? err.message : String(err) }); }
  }
  return NextResponse.json({ ok: true });
});
