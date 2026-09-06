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

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const POST = withObservability("quote-upload", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!store || store.status !== "ACTIVE") {
    return NextResponse.json({ error: "This business is not currently accepting quote requests." }, { status: 404 });
  }

  const ip = getClientIp(req.headers);
  const [storeRate, ipRate] = await Promise.all([
    checkRateLimit(`quote-upload:store:${store.id}`, 40, 60 * 60 * 1000),
    checkRateLimit(`quote-upload:ip:${ip}`, 20, 60 * 60 * 1000),
  ]);
  if (!storeRate.allowed || !ipRate.allowed) {
    return NextResponse.json({ error: "Too many uploads right now. Please try again later." }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, WEBP or PDF." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Each reference file must be 10MB or smaller." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `biznest/${store.id}/quote-references`, resource_type: "auto" },
        (error, uploaded) => {
          if (error || !uploaded) reject(error ?? new Error("Upload failed."));
          else resolve(uploaded);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url, name: file.name, type: file.type, size: file.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference upload failed.";
    void logError("STORAGE", "Public quote reference upload failed", { storeId: store.id, message });
    return NextResponse.json({ error: "We could not upload that reference file. Please try again." }, { status: 502 });
  }
});
