import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { stageLabel } from "@/lib/jobs";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails the customer a progress update with their job link. Never throws. `kind` picks the wording. */
export async function emailJobUpdate(jobId: string, kind: "STAGE" | "ESTIMATE" | "NOTE", message?: string): Promise<void> {
  try {
    const j = await prisma.jobCard.findUnique({ where: { id: jobId }, include: { store: true } });
    const to = j?.customerEmail?.trim();
    if (!j || !to) return;
    const link = buildStoreUrl(j.store, `/job/${j.accessToken}`);
    const first = esc(j.customerName.split(" ")[0] || "there");
    const lead = kind === "ESTIMATE" ? `Your estimate for <strong>${esc(j.title)}</strong> is ready for your approval.`
      : kind === "STAGE" ? `Update on <strong>${esc(j.title)}</strong> (${esc(j.jobNo)}): ${esc(stageLabel(j.niche, j.stage))}.`
      : `There's a new update on <strong>${esc(j.title)}</strong> (${esc(j.jobNo)}).`;
    const lines = [`Hi ${first},`, lead, ...(message ? [esc(message)] : []), `<a href="${esc(link)}">Open your job page</a>`];
    await sendOrderNotificationEmail(to, kind === "ESTIMATE" ? `Estimate ready: ${j.title}` : `Update: ${j.title}`, lines.join("<br/><br/>"), storeEmailBrand(j.store));
  } catch (err) {
    void logError("EMAIL", "Job update email failed", { jobId, kind, error: err instanceof Error ? err.message : String(err) });
  }
}
