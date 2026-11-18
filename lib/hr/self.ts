import { prisma } from "@/lib/prisma";

/**
 * The HR employee record that belongs to a signed-in user in this store, if any.
 * Linked either explicitly (HrEmployee.staffId -> the staff login) or by the same email address
 * on the employee record and the account.
 */
export async function findMyEmployee(storeId: string, user: { id: string; email?: string | null }) {
  const staff = await prisma.storeStaff.findFirst({ where: { storeId, userId: user.id, status: "ACTIVE" }, select: { id: true } });
  if (staff) {
    const linked = await prisma.hrEmployee.findFirst({ where: { storeId, staffId: staff.id, status: { not: "EXITED" } } });
    if (linked) return linked;
  }
  const email = user.email?.trim();
  if (!email) return null;
  return prisma.hrEmployee.findFirst({ where: { storeId, email: { equals: email, mode: "insensitive" }, status: { not: "EXITED" } } });
}
