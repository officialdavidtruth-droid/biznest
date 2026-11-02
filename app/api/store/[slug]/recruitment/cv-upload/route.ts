import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { checkRateLimit } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";
import { CV_ALLOWED_TYPES, CV_MAX_BYTES, CV_TYPE_HINT, cvFolderFor, makeCvRef } from "@/lib/recruitment-cv";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Staff upload of a candidate CV. Returns a private ref to store as the candidate's cvUrl. */
export const POST = withObservability("recruitment-cv-upload", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertAnyStorePermission(slug, ["plugin:recruitment-ats"]);
  if (!access.success) return NextResponse.json({ error: access.error }, { status: 403 });
  const entitlement = await getPluginEntitlement(access.store.id, "recruitment-ats");
  if (!entitlement.allowed || !entitlement.installed) return NextResponse.json({ error: "Install Recruitment to upload CVs." }, { status: 403 });

  const rate = await checkRateLimit(`recruit-cv:${session.user.id}`, 30, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many uploads — please wait a bit." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!CV_ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `Unsupported file type. Use ${CV_TYPE_HINT}.` }, { status: 400 });
  if (file.size > CV_MAX_BYTES) return NextResponse.json({ error: "CV must be 4MB or smaller." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: cvFolderFor(access.store.id), resource_type: "raw", type: "authenticated", use_filename: true, unique_filename: true },
        (error, uploaded) => (error || !uploaded ? reject(error ?? new Error("Upload failed.")) : resolve(uploaded)),
      );
      stream.end(buffer);
    });
    return NextResponse.json({ url: makeCvRef(result.public_id), name: file.name });
  } catch (err) {
    void logError("STORAGE", "Recruitment CV upload failed", { storeId: access.store.id, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "We couldn't upload that CV. Please try again." }, { status: 502 });
  }
});
