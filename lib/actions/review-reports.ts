"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import type { ReviewReportStatus } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { recomputeBusinessRating } from "@/lib/reviews/rating";
import { REVIEW_REPORT_MAX_DETAILS, REVIEW_REPORT_REASONS } from "@/lib/constants/review-report";

// Same shared-PIN gate as lib/actions/admin.ts (there is one platform-admin
// identity, so audit entries carry no userId).
async function assertPlatformStaff() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminSession(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  return { success: true as const };
}

// --- Merchant side ---------------------------------------------------------

/**
 * A merchant reports a review that breaks the rules. One report per review;
 * BizNest staff decide it in /supaadmin/review-reports. Nothing is hidden
 * until staff uphold the report.
 */
export async function reportReview(
  storeSlug: string,
  reviewId: string,
  reason: string,
  details?: string
): Promise<ActionResult> {
  const access = await assertStorePermission(storeSlug, "reviews");
  if (!access.success) return { success: false, error: access.error };

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  if (!REVIEW_REPORT_REASONS.some((r) => r.value === reason)) {
    return { success: false, error: "Please choose a reason." };
  }
  const note = details?.trim() || null;
  if (note && note.length > REVIEW_REPORT_MAX_DETAILS) {
    return { success: false, error: `Details can be at most ${REVIEW_REPORT_MAX_DETAILS} characters.` };
  }

  const limit = await checkRateLimit(`review-report:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) return { success: false, error: "You're reporting too quickly. Please try again later." };

  const review = await prisma.review.findFirst({
    where: { id: reviewId, storeId: access.store.id },
    select: {
      id: true,
      rating: true,
      comment: true,
      author: { select: { name: true } },
      report: { select: { id: true } },
    },
  });
  if (!review) return { success: false, error: "Review not found." };
  if (review.report) return { success: false, error: "This review has already been reported." };

  try {
    await prisma.reviewReport.create({
      data: {
        storeId: access.store.id,
        reviewId: review.id,
        reportedById: session.user.id,
        reason,
        details: note,
        reviewRating: review.rating,
        reviewComment: review.comment,
        reviewAuthorName: review.author.name,
      },
    });
  } catch (err) {
    // reviewId is unique: a concurrent double-submit lands here.
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "This review has already been reported." };
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "REVIEW_REPORTED", entity: "Review", entityId: review.id, metadata: { reason } },
  });

  revalidatePath(`/store/${storeSlug}/admin/reviews`);
  revalidatePath("/supaadmin/review-reports");
  return { success: true, data: undefined };
}

// --- Platform side ---------------------------------------------------------

export async function listReviewReports(status?: ReviewReportStatus) {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.reviewReport.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      adminNotes: true,
      resolvedAt: true,
      createdAt: true,
      reviewRating: true,
      reviewComment: true,
      reviewAuthorName: true,
      store: { select: { name: true, slug: true } },
      reportedBy: { select: { name: true, email: true } },
      review: { select: { images: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

/**
 * UPHELD removes the review (its public reply goes with it) and refreshes the
 * store's rating; DISMISSED keeps it. Either way the merchant is told, and a
 * note explaining the decision is required.
 */
export async function resolveReviewReport(
  reportId: string,
  decision: "UPHELD" | "DISMISSED",
  adminNotes: string
): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (decision !== "UPHELD" && decision !== "DISMISSED") return { success: false, error: "Invalid decision." };
  const notes = adminNotes.trim();
  if (!notes) return { success: false, error: "A note explaining the decision is required." };

  const report = await prisma.reviewReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      reviewId: true,
      storeId: true,
      store: { select: { slug: true, business: { select: { userId: true } } } },
    },
  });
  if (!report) return { success: false, error: "Report not found." };
  if (report.status !== "OPEN") return { success: false, error: "This report has already been decided." };

  const update = prisma.reviewReport.update({
    where: { id: report.id },
    data: { status: decision, adminNotes: notes, resolvedAt: new Date() },
  });

  if (decision === "UPHELD" && report.reviewId) {
    // The report row survives (reviewId -> NULL) with its snapshot of the review.
    await prisma.$transaction([update, prisma.review.delete({ where: { id: report.reviewId } })]);
    await recomputeBusinessRating(report.storeId);
  } else {
    await update;
  }

  await prisma.auditLog.create({
    data: { userId: null, action: `REVIEW_REPORT_${decision}`, entity: "ReviewReport", entityId: report.id },
  });

  // Best-effort: never fail the decision because the notification failed.
  try {
    if (report.store.business.userId) {
      await notifyUser({
        userId: report.store.business.userId,
        type: "REVIEW",
        title: decision === "UPHELD" ? "Reported review removed" : "Reported review kept",
        body: notes.slice(0, 140),
        url: `/store/${report.store.slug}/admin/reviews`,
      });
    }
  } catch (err) {
    console.error("[review-reports] merchant notification failed", err);
  }

  revalidatePath("/supaadmin/review-reports");
  revalidatePath(`/store/${report.store.slug}`);
  revalidatePath(`/store/${report.store.slug}/reviews`);
  revalidatePath(`/store/${report.store.slug}/admin/reviews`);
  return { success: true, data: undefined };
}
