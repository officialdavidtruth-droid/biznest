import { auth } from "@/lib/auth";
import { getStoreCustomerSession } from "@/lib/store-customer-auth";
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

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Review photo upload for storefront customers. /api/upload only recognises
 * the main (merchant) session, but storefront customers sign in through the
 * separate bn-store-customer cookie, so they need their own route. Images
 * only, smaller size cap, and a per-customer rate limit.
 */
export const POST = withObservability("reviews-upload", async (req: Request) => {
  const customerSession = await getStoreCustomerSession();
  const session = customerSession ? null : await auth();
  const userId = customerSession?.user?.id ?? (session?.user?.role === "CUSTOMER" ? session.user.id : null);
  if (!userId) return NextResponse.json({ error: "Please sign in to upload photos." }, { status: 401 });

  const rate = await checkRateLimit(`review-upload:${userId}`, 15, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a bit before trying again." },
      { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Only JPG, PNG or WebP images are allowed." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Image too large (5MB max)." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `biznest/reviews/${userId}`, resource_type: "image" },
        (error, result) => (error || !result ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    void logError("STORAGE", "Review photo upload failed", { userId, message });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
});
