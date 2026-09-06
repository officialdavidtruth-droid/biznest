"use server";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { logError } from "@/lib/observability/log";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { CreativeProjectStatus } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

// Design previews must come from our own upload pipeline (Cloudinary via
// /api/upload), not an arbitrary attacker-supplied URL rendered back as
// <img src> to the client on the public review page.
const ALLOWED_PREVIEW_HOSTS = new Set(["res.cloudinary.com"]);
function isAllowedPreviewUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_PREVIEW_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export type ReferenceFile = {
  url: string;
  name: string;
  type: string;
  size: number;
};

export type CreateCreativeProjectInput = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceType: string;
  brief: string;
  budget?: number;
  deadline?: string;
  referenceFiles?: ReferenceFile[];
};

export async function createCreativeProject(
  slug: string,
  input: CreateCreativeProjectInput
): Promise<ActionResult<{ projectId: string; projectNo: string; quoteId: string; quoteNo: string }>> {
  const storeAccess = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      status: true,
      business: { select: { userId: true, email: true } },
    },
  });
  if (!storeAccess || storeAccess.status !== "ACTIVE") {
    return { success: false, error: "This business is not currently accepting quote requests." };
  }

  // Public intake form — cap submissions per store and per IP so the quote
  // workflow cannot be abused to flood the merchant's workspace/inbox.
  const [perStore, perIp] = await Promise.all([
    checkRateLimit(`project-intake:store:${storeAccess.id}`, 20, 60 * 60 * 1000),
    checkRateLimit(`project-intake:ip:${await clientIpKey()}`, 10, 60 * 60 * 1000),
  ]);
  if (!perStore.allowed || !perIp.allowed) {
    return { success: false, error: "Too many quote requests right now — please try again a bit later." };
  }

  if (!input.customerName.trim() || !input.serviceType.trim() || input.brief.trim().length < 10) {
    return { success: false, error: "Please provide your name, service and a useful project brief." };
  }

  const budget = input.budget && input.budget > 0 ? input.budget : null;
  const referenceFiles = input.referenceFiles?.length ? input.referenceFiles : undefined;

  const created = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({
      where: { id: storeAccess.id },
      data: { nextQuoteNo: { increment: 1 } },
    });
    const number = store.nextQuoteNo - 1;
    const quoteNo = `${store.slug.slice(0, 12).toUpperCase()}-Q-${number}`;
    const projectNo = `${store.slug.slice(0, 12).toUpperCase()}-P-${number}`;

    // A storefront quote request is a real Quote record first. The CreativeProject
    // is linked to it so the existing design/production workflow remains available
    // without making the project table the only place the request can be found.
    const quote = await tx.quote.create({
      data: {
        quoteNo,
        storeId: storeAccess.id,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        serviceType: input.serviceType.trim(),
        brief: input.brief.trim(),
        budget,
        deadline: input.deadline ? new Date(input.deadline) : null,
        referenceFiles,
        subtotal: budget ?? 0,
        total: budget ?? 0,
        status: "DRAFT",
        items: {
          create: {
            description: input.serviceType.trim(),
            quantity: 1,
            unitPrice: budget ?? 0,
          },
        },
      },
    });

    const project = await tx.creativeProject.create({
      data: {
        projectNo,
        storeId: storeAccess.id,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        serviceType: input.serviceType.trim(),
        brief: input.brief.trim(),
        budget,
        deadline: input.deadline ? new Date(input.deadline) : null,
        referenceFiles,
        quoteId: quote.id,
      },
    });

    return { quote, project };
  });

  // The notification is only the alert. The Quote record above is the source
  // of truth and the notification opens that dedicated quote detail screen.
  try {
    await notifyUser({
      userId: storeAccess.business.userId,
      type: "PROJECT_REQUEST",
      title: `New quote request · ${created.quote.quoteNo}`,
      body: `${created.quote.customerName} requested ${created.quote.serviceType}.`,
      url: `/store/${slug}/admin/quotes/${created.quote.id}`,
    });
  } catch (err) {
    await logError("API", "Project request notification failed", {
      projectId: created.project.id,
      quoteId: created.quote.id,
      storeId: storeAccess.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Email is best-effort. It now points the merchant to the authenticated
  // Quotes workspace rather than the customer token page.
  const merchantEmail = storeAccess.contactEmail?.trim() || storeAccess.business.email?.trim();
  if (merchantEmail) {
    try {
      const result = await sendOrderNotificationEmail(
        merchantEmail,
        `New quote request ${created.quote.quoteNo}`,
        `<p><strong>${created.quote.customerName}</strong> requested <strong>${created.quote.serviceType}</strong>.</p><p>${created.quote.brief}</p><p><a href="${APP_URL}/store/${slug}/admin/quotes/${created.quote.id}">Open quote in BizNest</a></p>`
      );
      if (result?.error) {
        void logError("EMAIL", "Project request email failed", {
          projectId: created.project.id,
          quoteId: created.quote.id,
          to: merchantEmail,
          message: result.error.message,
        });
      }
    } catch (err) {
      void logError("EMAIL", "Project request email threw", {
        projectId: created.project.id,
        quoteId: created.quote.id,
        to: merchantEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath(`/${slug}/admin/quotes`);
  revalidatePath(`/${slug}/admin/projects`);

  return {
    success: true,
    data: {
      projectId: created.project.id,
      projectNo: created.project.projectNo,
      quoteId: created.quote.id,
      quoteNo: created.quote.quoteNo,
    },
  };
}

export async function listCreativeProjects(slug: string) {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return [];
  return prisma.creativeProject.findMany({
    where: { storeId: access.store.id },
    include: { revisions: { orderBy: { version: "desc" }, take: 1 }, quote: { select: { id: true, quoteNo: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getCreativeProject(slug: string, id: string) {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return null;
  return prisma.creativeProject.findFirst({
    where: { id, storeId: access.store.id },
    include: { revisions: { orderBy: { version: "desc" } }, quote: true },
  });
}

export async function getCreativeProjectPublic(id: string, token: string) {
  return prisma.creativeProject.findFirst({
    where: { id, publicAccessToken: token },
    include: {
      revisions: { orderBy: { version: "desc" } },
      store: { select: { name: true, slug: true, logoUrl: true, themeColors: true, businessType: true, contactEmail: true, contactPhone: true } },
    },
  });
}

export async function updateCreativeProjectStatus(slug: string, id: string, status: CreativeProjectStatus): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return { success: false, error: access.error };
  const p = await prisma.creativeProject.findFirst({ where: { id, storeId: access.store.id } });
  if (!p) return { success: false, error: "Project not found." };
  await prisma.creativeProject.update({ where: { id }, data: { status } });
  revalidatePath(`/${slug}/admin/projects`);
  revalidatePath(`/${slug}/admin/projects/${id}`);
  revalidatePath(`/store/projects/${id}`);
  return { success: true, data: undefined };
}

export async function addCreativeRevision(slug: string, id: string, previewUrl: string, note?: string): Promise<ActionResult<{ version: number }>> {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return { success: false, error: access.error };
  if (!isAllowedPreviewUrl(previewUrl)) return { success: false, error: "Upload a valid preview file first." };
  const p = await prisma.creativeProject.findFirst({ where: { id, storeId: access.store.id } });
  if (!p) return { success: false, error: "Project not found." };
  const version = p.currentVersion + 1;
  await prisma.$transaction([
    prisma.creativeProjectRevision.create({ data: { projectId: id, version, previewUrl, note: note?.trim() || null } }),
    prisma.creativeProject.update({ where: { id }, data: { currentVersion: version, status: "AWAITING_APPROVAL" } }),
  ]);
  if (p.customerEmail) {
    await sendOrderNotificationEmail(
      p.customerEmail,
      `Design v${version} is ready for ${p.projectNo}`,
      `<p>Your latest design is ready for review.</p><p><a href="${APP_URL}/store/projects/${p.id}?token=${p.publicAccessToken}">Review and approve the design</a></p>`
    );
  }
  revalidatePath(`/${slug}/admin/projects/${id}`);
  revalidatePath(`/store/projects/${id}`);
  return { success: true, data: { version } };
}

export async function approveCreativeProject(id: string, token: string, note?: string): Promise<ActionResult> {
  const p = await prisma.creativeProject.findFirst({ where: { id, publicAccessToken: token } });
  if (!p) return { success: false, error: "Project not found." };
  // Only a project actually awaiting the client's review can be approved —
  // without this, a valid token could push a project (even one still at
  // NEW, with no design uploaded) straight to APPROVED, or re-approve a
  // project that's already moved on to production/completion.
  if (p.status !== "AWAITING_APPROVAL") {
    return { success: false, error: "This project isn't currently awaiting your approval." };
  }
  await prisma.creativeProject.update({ where: { id }, data: { status: "APPROVED", approvalNote: note?.trim() || null } });
  revalidatePath(`/store/projects/${id}`);
  return { success: true, data: undefined };
}

export async function requestCreativeChanges(id: string, token: string, note: string): Promise<ActionResult> {
  const p = await prisma.creativeProject.findFirst({ where: { id, publicAccessToken: token } });
  if (!p) return { success: false, error: "Project not found." };
  if (p.status !== "AWAITING_APPROVAL") {
    return { success: false, error: "This project isn't currently awaiting your approval." };
  }
  if (note.trim().length < 3) return { success: false, error: "Tell the designer what needs to change." };
  await prisma.creativeProject.update({ where: { id }, data: { status: "DESIGN", approvalNote: note.trim() } });
  const store = await prisma.store.findUnique({ where: { id: p.storeId }, select: { slug: true, contactEmail: true } });
  if (store?.contactEmail) {
    await sendOrderNotificationEmail(store.contactEmail, `Changes requested for ${p.projectNo}`, `<p>${note.trim()}</p>`);
  }
  revalidatePath(`/store/projects/${id}`);
  if (store) revalidatePath(`/${store.slug}/admin/projects/${id}`);
  return { success: true, data: undefined };
}

// Best-effort caller IP for rate-limit keying in a server action (no
// Request object available here the way a route handler gets one).
async function clientIpKey() {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
