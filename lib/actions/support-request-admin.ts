"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import type { ActionResult } from "@/types/actions";

// Same shared-PIN gate as lib/actions/review-reports.ts.
async function assertPlatformStaff() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  return { success: true as const };
}

export async function listSupportRequests(status?: "OPEN" | "RESOLVED") {
  const access = await assertPlatformStaff();
  if (!access.success) return [];
  return prisma.supportRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function countOpenSupportRequests() {
  const access = await assertPlatformStaff();
  if (!access.success) return 0;
  return prisma.supportRequest.count({ where: { status: "OPEN" } });
}

export async function setSupportRequestStatus(id: string, status: "OPEN" | "RESOLVED"): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (status !== "OPEN" && status !== "RESOLVED") return { success: false, error: "Invalid status." };
  const updated = await prisma.supportRequest.updateMany({ where: { id }, data: { status } });
  if (updated.count === 0) return { success: false, error: "Request not found." };
  revalidatePath("/supaadmin/support-requests");
  return { success: true, data: undefined };
}
