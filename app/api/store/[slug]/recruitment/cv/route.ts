import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { withObservability } from "@/lib/observability/api-wrapper";
import { isStoreCvRef, parseCvRef } from "@/lib/recruitment-cv";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Staff-only CV viewer. The file location is looked up from the database by candidate id (the
 * request can't point us at an arbitrary file), checked against this store's folder, and the
 * browser is redirected to a 2-minute signed link.
 */
export const GET = withObservability("recruitment-cv", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await assertAnyStorePermission(slug, ["plugin:recruitment-ats"]);
  if (!access.success) return NextResponse.json({ error: access.error }, { status: 403 });

  const candidateId = new URL(req.url).searchParams.get("candidateId");
  if (!candidateId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const candidate = await prisma.recruitCandidate.findFirst({ where: { id: candidateId, storeId: access.store.id }, select: { cvUrl: true } });
  if (!candidate?.cvUrl) return NextResponse.json({ error: "No CV on file." }, { status: 404 });

  if (/^https?:\/\//i.test(candidate.cvUrl)) return NextResponse.redirect(candidate.cvUrl);
  const publicId = parseCvRef(candidate.cvUrl);
  if (!publicId || !isStoreCvRef(candidate.cvUrl, access.store.id)) return NextResponse.json({ error: "Unsupported CV location." }, { status: 422 });

  const url = cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
