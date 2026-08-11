import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const POST = withObservability("upload", async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 20 uploads / 10 minutes per user — keyed on user ID since this route is
  // already auth-gated, rather than IP (which is unreliable behind shared
  // networks/proxies anyway).
  const rate = await checkRateLimit(`upload:${session.user.id}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a bit before trying again." },
      { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (10MB max)" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `biznest/${session.user.id}`, resource_type: "auto" },
        (error, result) => {
          if (error || !result) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Upload provider isn't configured correctly. Check CLOUDINARY_* environment variables.";
    void logError("STORAGE", "Cloudinary upload failed", { userId: session.user.id, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
