import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";
import { isPlatformStaff } from "@/lib/admin-guard";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { OFFICIAL_SLUG } from "@/lib/browse";
import { BROWSE_VIDEO_MAX_BYTES, BROWSE_VIDEO_TYPES } from "@/lib/browse-video";
import { signBrowseVideoUpload } from "@/lib/browse-video-sign";

// Mints a signature for a direct Cloudinary video upload (video can't pass through a serverless body).
// The official BizNest account is the only place without the 60-second trim, and only for PIN-session staff.
export const POST = withObservability("browse-video-sign", async (req: Request) => {
  if (process.env.BROWSE_VIDEO === "off") return NextResponse.json({ error: "Video posting is switched off right now." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!slug) return NextResponse.json({ error: "Missing store." }, { status: 400 });
  if (!(BROWSE_VIDEO_TYPES as readonly string[]).includes(contentType)) return NextResponse.json({ error: "Use an MP4, MOV or WebM video." }, { status: 400 });
  if (size <= 0 || size > BROWSE_VIDEO_MAX_BYTES) return NextResponse.json({ error: `Video is too large (${BROWSE_VIDEO_MAX_BYTES / 1048576} MB max).` }, { status: 400 });

  const official = slug === OFFICIAL_SLUG;
  let storeId: string;
  if (official) {
    if (!(await isPlatformStaff())) return NextResponse.json({ error: "Admin PIN session expired. Sign in again." }, { status: 401 });
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Set up the BizNest official account first." }, { status: 400 });
    storeId = store.id;
  } else {
    const a = await assertStorePermission(slug, "marketing");
    if (!a.success) return NextResponse.json({ error: a.error }, { status: 403 });
    if (a.store.status !== "ACTIVE") return NextResponse.json({ error: "Your store must be active to post on Browse." }, { status: 403 });
    storeId = a.store.id;
  }

  const rate = await checkRateLimit(`browse-video-sign:${storeId}`, 10, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many video uploads. Wait a few minutes and try again." }, { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined });
  }
  return NextResponse.json(signBrowseVideoUpload(storeId, { official }));
});
