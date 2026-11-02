import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { withObservability } from "@/lib/observability/api-wrapper";
import { logError } from "@/lib/observability/log";
import { CV_ALLOWED_TYPES, CV_MAX_BYTES, CV_TYPE_HINT, cvFolderFor, makeCvRef } from "@/lib/recruitment-cv";
import { jobAcceptsApplications, parsePublicApplication } from "@/lib/recruitment-public";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Public job application: creates (or reuses) the candidate and files an APPLIED application. */
export const POST = withObservability("careers-apply", async (req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, business: { select: { userId: true } } } });
  // Same answer for "no such store", "not active" and "Recruitment not installed" — don't reveal which.
  const closed = () => fail("This business isn't accepting applications right now.", 404);
  if (!store || store.status !== "ACTIVE") return closed();
  const ent = await getPluginEntitlement(store.id, "recruitment-ats");
  if (!ent.allowed || !ent.installed) return closed();

  const ip = getClientIp(req.headers);
  const [byStore, byIp] = await Promise.all([
    checkRateLimit(`careers-apply:store:${store.id}`, 200, 60 * 60 * 1000),
    checkRateLimit(`careers-apply:ip:${ip}`, 8, 60 * 60 * 1000),
  ]);
  if (!byStore.allowed || !byIp.allowed) return fail("Too many applications right now. Please try again later.", 429);

  const form = await req.formData();
  // Honeypot: real people never see or fill this field. Pretend success so bots learn nothing.
  if (String(form.get("website") ?? "").trim()) return NextResponse.json({ ok: true });

  const jobId = String(form.get("jobId") ?? "");
  const job = jobId ? await prisma.recruitJob.findFirst({ where: { id: jobId, storeId: store.id }, select: { id: true, title: true, status: true, closesAt: true } }) : null;
  if (!job || !jobAcceptsApplications(job)) return fail("This job is no longer accepting applications.", 410);

  const file = form.get("cvFile");
  const hasFile = file instanceof File && file.size > 0;
  const parsed = parsePublicApplication(form, hasFile);
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;
  if (hasFile) {
    if (!CV_ALLOWED_TYPES.has(file.type)) return fail(`Unsupported CV type. Use ${CV_TYPE_HINT}.`);
    if (file.size > CV_MAX_BYTES) return fail("Your CV must be 4MB or smaller.");
  }

  // Already applied for this role? Check before spending an upload.
  const existing = await prisma.recruitCandidate.findFirst({ where: { storeId: store.id, email: d.email }, select: { id: true, cvUrl: true } });
  if (existing) {
    const dup = await prisma.recruitApplication.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: existing.id } }, select: { id: true } });
    if (dup) return fail("You've already applied for this role — we have your application.", 409);
  }

  let cvUrl = d.cvLink;
  if (hasFile) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await new Promise<{ public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: cvFolderFor(store.id), resource_type: "raw", type: "authenticated", use_filename: true, unique_filename: true },
          (error, uploaded) => (error || !uploaded ? reject(error ?? new Error("Upload failed.")) : resolve(uploaded)),
        );
        stream.end(buffer);
      });
      cvUrl = makeCvRef(result.public_id);
    } catch (err) {
      void logError("STORAGE", "Careers CV upload failed", { storeId: store.id, message: err instanceof Error ? err.message : String(err) });
      return fail("We couldn't upload your CV. Please try again, or paste a link to it instead.", 502);
    }
  }

  try {
    const candidateId = existing
      ? existing.id
      : (await prisma.recruitCandidate.create({
          data: {
            storeId: store.id, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, location: d.location,
            currentRole: d.currentRole, currentCompany: d.currentCompany, cvUrl, source: "Careers page",
          },
          select: { id: true },
        })).id;
    // A returning candidate keeps their record; just fill in a CV if they had none.
    if (existing && !existing.cvUrl && cvUrl) await prisma.recruitCandidate.update({ where: { id: existing.id }, data: { cvUrl } });
    await prisma.recruitApplication.create({
      data: { storeId: store.id, jobId: job.id, candidateId, notes: d.coverNote ? `Cover note: ${d.coverNote}` : null },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return fail("You've already applied for this role — we have your application.", 409);
    void logError("API", "Careers application failed", { storeId: store.id, message: err instanceof Error ? err.message : String(err) });
    return fail("We couldn't submit your application. Please try again.", 500);
  }

  // Tell the owner and recruiting staff. Never let a notification problem fail the applicant.
  try {
    const staff = await prisma.storeStaff.findMany({ where: { storeId: store.id, status: "ACTIVE", userId: { not: null }, permissions: { has: "plugin:recruitment-ats" } }, select: { userId: true } });
    const recipients = new Set<string>([store.business.userId]);
    for (const s of staff) if (s.userId) recipients.add(s.userId);
    await Promise.allSettled([...recipients].map((userId) => notifyUser({
      userId, type: "NEW_APPLICANT", title: "New job application",
      body: `${d.firstName} ${d.lastName} applied for ${job.title}.`, url: `/store/${store.slug}/admin/apps/recruitment-ats`,
    })));
  } catch { /* best effort */ }

  return NextResponse.json({ ok: true });
});
