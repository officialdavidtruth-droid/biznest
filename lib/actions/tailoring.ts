"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { MEASUREMENT_FIELDS, isTailoringStage, type TailoringFabric, type TailoringMeasurements } from "@/lib/tailoring";
import type { ActionResult } from "@/types/actions";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();

export async function listTailoringJobs(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { error: a.error };
  const jobs = await prisma.tailoringJob.findMany({ where: { storeId: a.store.id }, orderBy: [{ createdAt: "desc" }], take: 200 });
  return { jobs: JSON.parse(JSON.stringify(jobs)) as TailoringJobDTO[] };
}

export type TailoringJobDTO = {
  id: string; jobNo: string; customerName: string; customerPhone: string | null; garmentType: string;
  stage: string; dueDate: string | null; measurements: TailoringMeasurements | null; fabric: TailoringFabric | null;
  notes: string | null; createdAt: string;
};

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

  const given = text(form, "jobNo").toUpperCase();
  let next = (await prisma.tailoringJob.count({ where: { storeId: a.store.id } })) + 1;
  for (let attempt = 0; attempt < 6; attempt++) {
    const jobNo = given && attempt === 0 ? given : `JOB-${String(next++).padStart(4, "0")}`;
    try {
      const job = await prisma.tailoringJob.create({
        data: {
          storeId: a.store.id, jobNo, customerName, garmentType,
          customerPhone: text(form, "customerPhone") || null,
          dueDate: dueDate ?? undefined,
          measurements: measurements as never, fabric: fabric as never,
          notes: text(form, "notes") || null,
        },
      });
      return { success: true, data: JSON.parse(JSON.stringify(job)) as TailoringJobDTO };
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

export async function deleteTailoringJob(slug: string, id: string): Promise<ActionResult<void>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.tailoringJob.deleteMany({ where: { id, storeId: a.store.id } });
  if (!res.count) return { success: false, error: "Job not found." };
  return { success: true, data: undefined };
}
