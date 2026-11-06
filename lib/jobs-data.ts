import { prisma } from "@/lib/prisma";
import { itemsTotal, outstanding, stageLabel } from "@/lib/jobs";

export async function loadJobsWorkspace(storeId: string) {
  const jobs = await prisma.jobCard.findMany({
    where: { storeId }, orderBy: { createdAt: "desc" }, take: 200,
    include: { items: { orderBy: { id: "asc" } }, charges: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" } }, updates: { orderBy: { at: "desc" }, take: 8 } },
  });
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    jobs: jobs.map((j) => {
      const items = j.items.map((i) => ({ id: i.id, kind: i.kind, label: i.label, qty: i.qty, unitPrice: Number(i.unitPrice) }));
      const charges = j.charges.map((c) => ({ id: c.id, label: c.label, amount: Number(c.amount), status: c.status, paidAt: iso(c.paidAt), receiptNo: c.receiptNo, method: c.method }));
      return {
        id: j.id, jobNo: j.jobNo, niche: j.niche, title: j.title, customerName: j.customerName, customerPhone: j.customerPhone, customerEmail: j.customerEmail,
        subject: j.subject, subjectDetail: j.subjectDetail, stage: j.stage, stageLabel: stageLabel(j.niche, j.stage), status: j.status, scheduledFor: iso(j.scheduledFor),
        estimateStatus: j.estimateStatus, deliverableUrl: j.deliverableUrl, internalNotes: j.internalNotes, accessToken: j.accessToken, createdAt: j.createdAt.toISOString(),
        items, total: itemsTotal(items), charges, owing: outstanding(charges),
        updates: j.updates.map((u) => ({ id: u.id, message: u.message, imageUrl: u.imageUrl, stage: u.stage, at: u.at.toISOString() })),
      };
    }),
  };
}
export type JobsData = Awaited<ReturnType<typeof loadJobsWorkspace>>;
