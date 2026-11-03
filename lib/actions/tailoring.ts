"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import {
  MAX_TAILORING_PHOTOS, MEASUREMENT_FIELDS, isTailoringPhotoUrl, isTailoringStage, parseTailoringPhotos, tailoringOrderFormPath,
  type TailoringFabric, type TailoringMeasurements, type TailoringPhoto, type TailoringPhotoKind,
} from "@/lib/tailoring";
import { describeNotifyOutcome, notifyTailoringStage } from "@/lib/tailoring-notify";
import type { ActionResult } from "@/types/actions";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const money = (n: number) => Math.round(n * 100) / 100;

export type TailoringJobDTO = {
  id: string; jobNo: string; customerName: string; customerPhone: string | null; garmentType: string;
  stage: string; dueDate: string | null; measurements: TailoringMeasurements | null; fabric: TailoringFabric | null;
  notes: string | null; createdAt: string;
  price: number | null; amountPaid: number; trackingToken: string;
  tailorName: string | null; photos: TailoringPhoto[];
};

export type TailoringRequestDTO = {
  id: string; customerName: string; customerPhone: string; customerEmail: string | null; garmentType: string;
  details: string | null; neededBy: string | null; photos: TailoringPhoto[]; createdAt: string;
};

type JobRow = Awaited<ReturnType<typeof prisma.tailoringJob.findMany>>[number];

// Prisma Decimals do not survive a plain JSON round trip as numbers, so map them explicitly.
function toDTO(job: JobRow): TailoringJobDTO {
  const { price, amountPaid, photos, ...rest } = job;
  return {
    ...(JSON.parse(JSON.stringify(rest)) as Omit<TailoringJobDTO, "price" | "amountPaid" | "photos">),
    price: price == null ? null : Number(price),
    amountPaid: Number(amountPaid),
    photos: parseTailoringPhotos(photos),
  };
}

type RequestRow = Awaited<ReturnType<typeof prisma.tailoringRequest.findMany>>[number];
function requestToDTO(r: RequestRow): TailoringRequestDTO {
  return {
    id: r.id, customerName: r.customerName, customerPhone: r.customerPhone, customerEmail: r.customerEmail, garmentType: r.garmentType,
    details: r.details, neededBy: r.neededBy ? r.neededBy.toISOString() : null, photos: parseTailoringPhotos(r.photos), createdAt: r.createdAt.toISOString(),
  };
}

/** Tailor names are free text; cap and tidy them so the filter list stays clean. */
const cleanTailor = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 60);

export async function listTailoringJobs(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { error: a.error };
  const [jobs, requests] = await Promise.all([
    prisma.tailoringJob.findMany({ where: { storeId: a.store.id }, orderBy: [{ createdAt: "desc" }], take: 200 }),
    prisma.tailoringRequest.findMany({ where: { storeId: a.store.id, status: "NEW" }, orderBy: [{ createdAt: "desc" }], take: 50 }),
  ]);
  return {
    jobs: jobs.map(toDTO),
    requests: requests.map(requestToDTO),
    currency: a.store.currency,
    autoNotify: a.store.tailoringAutoNotify,
    orderFormPath: tailoringOrderFormPath(a.store.slug),
  };
}

/** Saved measurements for a returning customer, looked up by phone. Used to pre-fill the new-job form. */
export async function findTailoringClient(slug: string, phone: string): Promise<ActionResult<{ name: string; measurements: TailoringMeasurements | null } | null>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const phoneKey = normalizeWhatsAppNumber(phone);
  if (!phoneKey) return { success: true, data: null };
  const c = await prisma.tailoringClient.findUnique({ where: { storeId_phoneKey: { storeId: a.store.id, phoneKey } }, select: { name: true, measurements: true } });
  return { success: true, data: c ? { name: c.name, measurements: (c.measurements as TailoringMeasurements | null) ?? null } : null };
}

export async function createTailoringJobFromForm(slug: string, form: FormData): Promise<ActionResult<TailoringJobDTO>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const customerName = text(form, "customerName"), garmentType = text(form, "garmentType");
  if (!customerName || !garmentType) return { success: false, error: "Customer name and garment type are required." };

  const dueRaw = text(form, "dueDate");
  const dueDate = dueRaw ? new Date(dueRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { success: false, error: "Enter a valid due date." };

  const unit = text(form, "unit") === "cm" ? "cm" : "in";
  const values: Record<string, number> = {};
  for (const f of MEASUREMENT_FIELDS) {
    const raw = text(form, `m_${f.id}`);
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return { success: false, error: `${f.label} must be a positive number.` };
    values[f.id] = n;
  }
  const measurements: TailoringMeasurements | undefined = Object.keys(values).length ? { unit, values } : undefined;

  const fabricDescription = text(form, "fabric");
  const yards = Number(text(form, "yards") || 0);
  const fabric: TailoringFabric | undefined = fabricDescription || yards > 0 ? { description: fabricDescription || undefined, yards: yards > 0 ? yards : undefined } : undefined;

  // Money
  const priceRaw = text(form, "price"), paidRaw = text(form, "amountPaid");
  const price = priceRaw ? Number(priceRaw) : null;
  const amountPaid = paidRaw ? Number(paidRaw) : 0;
  if (price != null && (!Number.isFinite(price) || price < 0)) return { success: false, error: "Price must be a positive number." };
  if (!Number.isFinite(amountPaid) || amountPaid < 0) return { success: false, error: "Deposit must be a positive number." };
  if (amountPaid > 0 && price == null) return { success: false, error: "Enter the price before recording a deposit." };
  if (price != null && amountPaid > price) return { success: false, error: "The deposit can't be more than the price." };

  // Returning-customer profile: one per phone number per store. The newest measurements win.
  const customerPhone = text(form, "customerPhone") || null;
  const clientId = await upsertTailoringClient(a.store.id, customerName, customerPhone, measurements);

  const created = await createJobWithNumber(a.store.id, text(form, "jobNo").toUpperCase(), {
    customerName, garmentType, customerPhone, clientId,
    dueDate: dueDate ?? undefined,
    measurements: measurements as never, fabric: fabric as never,
    notes: text(form, "notes") || null,
    price: price == null ? null : money(price),
    amountPaid: money(amountPaid),
    tailorName: cleanTailor(text(form, "tailorName")) || null,
  });
  return created.ok ? { success: true, data: toDTO(created.job) } : { success: false, error: created.error };
}

/** Saves/refreshes the returning-customer profile. A profile is a convenience: it never blocks the job. */
async function upsertTailoringClient(storeId: string, name: string, phone: string | null, measurements?: TailoringMeasurements): Promise<string | null> {
  const phoneKey = normalizeWhatsAppNumber(phone);
  if (!phoneKey) return null;
  const data = { name, phone, ...(measurements ? { measurements: measurements as never } : {}) };
  try {
    const c = await prisma.tailoringClient.upsert({
      where: { storeId_phoneKey: { storeId, phoneKey } },
      create: { storeId, phoneKey, ...data },
      update: data,
      select: { id: true },
    });
    return c.id;
  } catch {
    return null;
  }
}

type NewJobData = Omit<Prisma.TailoringJobUncheckedCreateInput, "storeId" | "jobNo">;

/** Creates a job with the next free job number (JOB-0001...). A number the owner typed is used as-is or rejected. */
async function createJobWithNumber(storeId: string, given: string, data: NewJobData): Promise<{ ok: true; job: JobRow } | { ok: false; error: string }> {
  let next = (await prisma.tailoringJob.count({ where: { storeId } })) + 1;
  for (let attempt = 0; attempt < 6; attempt++) {
    const jobNo = given && attempt === 0 ? given : `JOB-${String(next++).padStart(4, "0")}`;
    try {
      const job = await prisma.tailoringJob.create({ data: { ...data, storeId, jobNo } });
      return { ok: true, job };
    } catch (err) {
      // P2002 = job number already taken (unique per store); try the next one unless the owner typed it.
      if ((err as { code?: string }).code === "P2002") {
        if (given && attempt === 0) return { ok: false, error: `Job number ${given} is already in use.` };
        continue;
      }
      return { ok: false, error: "Could not create the job." };
    }
  }
  return { ok: false, error: "Could not generate a unique job number. Try again." };
}

/** Moves a job to a stage. When the store has automatic updates on, the customer is messaged (WhatsApp, then SMS). */
export async function updateTailoringStage(slug: string, id: string, stage: string): Promise<ActionResult<{ notice: string | null }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  if (!isTailoringStage(stage)) return { success: false, error: "Invalid stage." };
  const before = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { stage: true } });
  if (!before) return { success: false, error: "Job not found." };
  if (before.stage === stage) return { success: true, data: { notice: null } };
  const res = await prisma.tailoringJob.updateMany({ where: { id, storeId: a.store.id }, data: { stage } });
  if (!res.count) return { success: false, error: "Job not found." };
  // Awaited: un-awaited sends are dropped when the serverless invocation returns. The helper never throws.
  const outcome = a.store.tailoringAutoNotify ? await notifyTailoringStage(id) : null;
  return { success: true, data: { notice: outcome ? describeNotifyOutcome(outcome) : null } };
}

/** Turns automatic customer messages on or off for the whole store. */
export async function setTailoringAutoNotify(slug: string, on: boolean): Promise<ActionResult<{ on: boolean }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  await prisma.store.update({ where: { id: a.store.id }, data: { tailoringAutoNotify: !!on } });
  return { success: true, data: { on: !!on } };
}

/** Who is making this job. Empty clears it. */
export async function setTailoringTailor(slug: string, id: string, name: string): Promise<ActionResult<{ tailorName: string | null }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const tailorName = cleanTailor(String(name ?? "")) || null;
  const res = await prisma.tailoringJob.updateMany({ where: { id, storeId: a.store.id }, data: { tailorName } });
  if (!res.count) return { success: false, error: "Job not found." };
  return { success: true, data: { tailorName } };
}

/** Attaches an uploaded photo (see /api/upload) to a job. */
export async function addTailoringPhoto(slug: string, id: string, url: string, kind: TailoringPhotoKind, caption?: string): Promise<ActionResult<{ photos: TailoringPhoto[] }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  if (!isTailoringPhotoUrl(url)) return { success: false, error: "That photo couldn't be used. Upload it again." };
  const job = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { photos: true } });
  if (!job) return { success: false, error: "Job not found." };
  const photos = parseTailoringPhotos(job.photos);
  if (photos.length >= MAX_TAILORING_PHOTOS) return { success: false, error: `A job can hold up to ${MAX_TAILORING_PHOTOS} photos.` };
  photos.push({ url, kind: kind === "progress" ? "progress" : "reference", caption: caption?.trim().slice(0, 140) || undefined, at: new Date().toISOString() });
  await prisma.tailoringJob.update({ where: { id }, data: { photos: photos as never } });
  return { success: true, data: { photos } };
}

export async function removeTailoringPhoto(slug: string, id: string, url: string): Promise<ActionResult<{ photos: TailoringPhoto[] }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const job = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { photos: true } });
  if (!job) return { success: false, error: "Job not found." };
  const photos = parseTailoringPhotos(job.photos).filter((p) => p.url !== url);
  await prisma.tailoringJob.update({ where: { id }, data: { photos: photos as never } });
  return { success: true, data: { photos } };
}

/** Flips a photo between "reference" (staff only) and "progress" (shown to the customer). */
export async function setTailoringPhotoKind(slug: string, id: string, url: string, kind: TailoringPhotoKind): Promise<ActionResult<{ photos: TailoringPhoto[] }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const job = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { photos: true } });
  if (!job) return { success: false, error: "Job not found." };
  const photos = parseTailoringPhotos(job.photos).map((p) => (p.url === url ? { ...p, kind: kind === "progress" ? "progress" as const : "reference" as const } : p));
  await prisma.tailoringJob.update({ where: { id }, data: { photos: photos as never } });
  return { success: true, data: { photos } };
}

/** Turns a storefront order request into a job (same customer profile and job numbering as a hand-made job). */
export async function acceptTailoringRequest(slug: string, requestId: string): Promise<ActionResult<TailoringJobDTO>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  // Claim first so two people (or a double click) can't convert the same request twice.
  const claimed = await prisma.tailoringRequest.updateMany({ where: { id: requestId, storeId: a.store.id, status: "NEW" }, data: { status: "CONVERTED" } });
  if (!claimed.count) return { success: false, error: "This request was already handled." };
  const req = await prisma.tailoringRequest.findUniqueOrThrow({ where: { id: requestId } });

  const clientId = await upsertTailoringClient(a.store.id, req.customerName, req.customerPhone);
  const photos = parseTailoringPhotos(req.photos);
  const created = await createJobWithNumber(a.store.id, "", {
    customerName: req.customerName, garmentType: req.garmentType, customerPhone: req.customerPhone, clientId,
    dueDate: req.neededBy ?? undefined,
    notes: req.details || null,
    photos: photos.length ? (photos as never) : undefined,
  });
  if (!created.ok) {
    await prisma.tailoringRequest.updateMany({ where: { id: requestId, status: "CONVERTED", jobId: null }, data: { status: "NEW" } });
    return { success: false, error: created.error };
  }
  await prisma.tailoringRequest.update({ where: { id: requestId }, data: { jobId: created.job.id } });
  return { success: true, data: toDTO(created.job) };
}

export async function dismissTailoringRequest(slug: string, requestId: string): Promise<ActionResult<void>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.tailoringRequest.updateMany({ where: { id: requestId, storeId: a.store.id, status: "NEW" }, data: { status: "DISMISSED" } });
  if (!res.count) return { success: false, error: "This request was already handled." };
  return { success: true, data: undefined };
}

/** Set or change the agreed price. It can't drop below what has already been paid. */
export async function updateTailoringPrice(slug: string, id: string, price: number): Promise<ActionResult<{ price: number }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  if (!Number.isFinite(price) || price < 0) return { success: false, error: "Price must be a positive number." };
  const job = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { amountPaid: true } });
  if (!job) return { success: false, error: "Job not found." };
  if (price < Number(job.amountPaid)) return { success: false, error: "The price can't be lower than what's already been paid." };
  await prisma.tailoringJob.update({ where: { id }, data: { price: money(price) } });
  return { success: true, data: { price: money(price) } };
}

/** Add a payment (deposit or balance) to a job. Returns the new total paid. */
export async function recordTailoringPayment(slug: string, id: string, amount: number): Promise<ActionResult<{ amountPaid: number }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter an amount greater than zero." };
  const job = await prisma.tailoringJob.findFirst({ where: { id, storeId: a.store.id }, select: { price: true, amountPaid: true } });
  if (!job) return { success: false, error: "Job not found." };
  if (job.price == null) return { success: false, error: "Set the price first." };
  const total = money(Number(job.amountPaid) + amount);
  if (total > Number(job.price)) return { success: false, error: "That's more than the balance owed." };
  await prisma.tailoringJob.update({ where: { id }, data: { amountPaid: total } });
  return { success: true, data: { amountPaid: total } };
}

export async function deleteTailoringJob(slug: string, id: string): Promise<ActionResult<void>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.tailoringJob.deleteMany({ where: { id, storeId: a.store.id } });
  if (!res.count) return { success: false, error: "Job not found." };
  return { success: true, data: undefined };
}
