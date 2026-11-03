"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import { MEASUREMENT_FIELDS, isTailoringStage, type TailoringFabric, type TailoringMeasurements } from "@/lib/tailoring";
import type { ActionResult } from "@/types/actions";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const money = (n: number) => Math.round(n * 100) / 100;

export type TailoringJobDTO = {
  id: string; jobNo: string; customerName: string; customerPhone: string | null; garmentType: string;
  stage: string; dueDate: string | null; measurements: TailoringMeasurements | null; fabric: TailoringFabric | null;
  notes: string | null; createdAt: string;
  price: number | null; amountPaid: number; trackingToken: string;
};

type JobRow = Awaited<ReturnType<typeof prisma.tailoringJob.findMany>>[number];

// Prisma Decimals do not survive a plain JSON round trip as numbers, so map them explicitly.
function toDTO(job: JobRow): TailoringJobDTO {
  const { price, amountPaid, ...rest } = job;
  return {
    ...(JSON.parse(JSON.stringify(rest)) as Omit<TailoringJobDTO, "price" | "amountPaid">),
    price: price == null ? null : Number(price),
    amountPaid: Number(amountPaid),
  };
}

export async function listTailoringJobs(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { error: a.error };
  const jobs = await prisma.tailoringJob.findMany({ where: { storeId: a.store.id }, orderBy: [{ createdAt: "desc" }], take: 200 });
  return { jobs: jobs.map(toDTO), currency: a.store.currency };
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
  const phoneKey = normalizeWhatsAppNumber(customerPhone);
  let clientId: string | null = null;
  if (phoneKey) {
    const data = { name: customerName, phone: customerPhone, ...(measurements ? { measurements: measurements as never } : {}) };
    try {
      const c = await prisma.tailoringClient.upsert({
        where: { storeId_phoneKey: { storeId: a.store.id, phoneKey } },
        create: { storeId: a.store.id, phoneKey, ...data },
        update: data,
        select: { id: true },
      });
      clientId = c.id;
    } catch {
      // A profile is a convenience; never block the job on it.
    }
  }

  const given = text(form, "jobNo").toUpperCase();
  let next = (await prisma.tailoringJob.count({ where: { storeId: a.store.id } })) + 1;
  for (let attempt = 0; attempt < 6; attempt++) {
    const jobNo = given && attempt === 0 ? given : `JOB-${String(next++).padStart(4, "0")}`;
    try {
      const job = await prisma.tailoringJob.create({
        data: {
          storeId: a.store.id, jobNo, customerName, garmentType, customerPhone, clientId,
          dueDate: dueDate ?? undefined,
          measurements: measurements as never, fabric: fabric as never,
          notes: text(form, "notes") || null,
          price: price == null ? null : money(price),
          amountPaid: money(amountPaid),
        },
      });
      return { success: true, data: toDTO(job) };
    } catch (err) {
      // P2002 = job number already taken (unique per store); try the next one unless the owner typed it.
      if ((err as { code?: string }).code === "P2002") {
        if (given && attempt === 0) return { success: false, error: `Job number ${given} is already in use.` };
        continue;
      }
      return { success: false, error: "Could not create the job." };
    }
  }
  return { success: false, error: "Could not generate a unique job number. Try again." };
}

export async function updateTailoringStage(slug: string, id: string, stage: string): Promise<ActionResult<void>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  if (!isTailoringStage(stage)) return { success: false, error: "Invalid stage." };
  const res = await prisma.tailoringJob.updateMany({ where: { id, storeId: a.store.id }, data: { stage } });
  if (!res.count) return { success: false, error: "Job not found." };
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
