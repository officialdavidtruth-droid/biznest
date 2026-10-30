import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { withObservability } from "@/lib/observability/api-wrapper";
import { DIGITAL_ALLOWED_TYPES, DIGITAL_MAX_BYTES, signDigitalUpload } from "@/lib/digital-files";

// Mints a signature so the browser can upload a digital product file directly
// to Cloudinary (large files can't pass through a serverless function body).
export const POST = withObservability("upload-sign", async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`upload-sign:${session.user.id}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a bit before trying again." },
      { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
    );
  }

  const body = await req.json().catch(() => null);
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!DIGITAL_ALLOWED_TYPES.has(contentType)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  if (size <= 0 || size > DIGITAL_MAX_BYTES) {
    return NextResponse.json({ error: `File too large (${Math.round(DIGITAL_MAX_BYTES / 1024 / 1024)}MB max)` }, { status: 400 });
  }

  return NextResponse.json(signDigitalUpload(session.user.id));
});
