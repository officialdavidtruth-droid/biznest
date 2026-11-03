import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Public upload for the storefront order form: a style or fabric reference photo. Images only, tightly rate limited. */
export const POST = withObservability("tailoring-upload", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!store || store.status !== "ACTIVE") {
    return NextResponse.json({ error: "This business is not currently taking orders." }, { status: 404 });
  }

  const ip = getClientIp(req.headers);
  const [storeRate, ipRate] = await Promise.all([
    checkRateLimit(`tailoring-upload:store:${store.id}`, 80, 60 * 60 * 1000),
    checkRateLimit(`tailoring-upload:ip:${ip}`, 12, 60 * 60 * 1000),
  ]);
  if (!storeRate.allowed || !ipRate.allowed) {
    return NextResponse.json({ error: "Too many uploads right now. Please try again later." }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WEBP photo." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Each photo must be 8MB or smaller." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `biznest/${store.id}/tailoring-requests`, resource_type: "image" },
        (error, uploaded) => (error || !uploaded ? reject(error ?? new Error("Upload failed.")) : resolve(uploaded))
      );
      stream.end(buffer);
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    void logError("STORAGE", "Public tailoring photo upload failed", { storeId: store.id, message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "We could not upload that photo. Please try again." }, { status: 502 });
  }
});
