import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";
import { kycFolderFor } from "@/lib/kyc-storage";
import { DIGITAL_ALLOWED_TYPES, DIGITAL_MAX_BYTES, makePrivateRef } from "@/lib/digital-files";

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
  const isDigital = formData.get("purpose") === "digital";
  if (!(isDigital ? DIGITAL_ALLOWED_TYPES : ALLOWED_TYPES).has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  const maxBytes = isDigital ? DIGITAL_MAX_BYTES : MAX_FILE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File too large (${Math.round(maxBytes / 1024 / 1024)}MB max)` }, { status: 400 });
  }

  // purpose=kyc -> identity documents: stored as Cloudinary "authenticated"
  // assets in a per-user folder, so the returned URL is NOT publicly viewable.
  // Everything else stays a normal public upload.
  const isKyc = formData.get("purpose") === "kyc";

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        isDigital
          ? { folder: `biznest/${session.user.id}/digital`, resource_type: "raw", type: "authenticated", use_filename: true, unique_filename: true }
          : isKyc
          ? { folder: kycFolderFor(session.user.id), resource_type: "auto", type: "authenticated" }
          : { folder: `biznest/${session.user.id}`, resource_type: "auto" },
        (error, result) => {
          if (error || !result) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Digital files return a private reference, never a fetchable URL.
    return NextResponse.json({ url: isDigital ? makePrivateRef(result.public_id) : result.secure_url, ...(isDigital ? { filename: file.name } : {}) });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Upload provider isn't configured correctly. Check CLOUDINARY_* environment variables.";
    void logError("STORAGE", "Cloudinary upload failed", { userId: session.user.id, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
