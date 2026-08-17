"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { sendStaffInviteEmail } from "@/lib/email/send";
import { canManageBillingAndStaff, getStoreAccessRole } from "@/lib/access/store-access";
import { notifyUser } from "@/lib/notifications/notify";
import { STAFF_PERMISSION_IDS } from "@/lib/access/staff-permissions";
import type { ActionResult } from "@/types/actions";

const MAX_STAFF_PER_STORE = 20;

async function requireOwner(slug: string, userId: string, userRole: string) {
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { store: null, error: "Store not found." };
  const role = await getStoreAccessRole(userId, userRole, store);
  if (!canManageBillingAndStaff(role)) return { store: null, error: "Only the store owner can manage staff." };
  return { store, error: null };
}

export async function inviteStaffMember(
  slug: string,
  email: string,
  role: "MANAGER" | "STAFF",
  name: string,
  position: string,
  permissions: string[]
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (normalizedEmail === session.user.email?.toLowerCase()) {
    return { success: false, error: "You're already the owner of this store." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, error: "Enter the staff member's name." };
  const trimmedPosition = position.trim();
  if (!trimmedPosition) return { success: false, error: "Enter the staff member's position." };

  const validPermissions = permissions.filter((p) => STAFF_PERMISSION_IDS.includes(p as (typeof STAFF_PERMISSION_IDS)[number]));
  if (validPermissions.length === 0) {
    return { success: false, error: "Select at least one area they should have access to." };
  }

  const existingCount = await prisma.storeStaff.count({
    where: { storeId: store.id, status: { in: ["PENDING", "ACTIVE"] } },
  });
  if (existingCount >= MAX_STAFF_PER_STORE) {
    return { success: false, error: `You've reached the ${MAX_STAFF_PER_STORE}-staff limit for one store.` };
  }

  const existing = await prisma.storeStaff.findUnique({
    where: { storeId_invitedEmail: { storeId: store.id, invitedEmail: normalizedEmail } },
  });
  if (existing?.status === "ACTIVE") {
    return { success: false, error: "This person already has access to your store." };
  }

  const token = nanoid(32);
  if (existing) {
    await prisma.storeStaff.update({
      where: { id: existing.id },
      data: {
        role,
        invitedName: trimmedName,
        position: trimmedPosition,
        permissions: validPermissions,
        status: "PENDING",
        inviteToken: token,
        invitedByUserId: session.user.id,
        invitedAt: new Date(),
        acceptedAt: null,
      },
    });
  } else {
    await prisma.storeStaff.create({
      data: {
        storeId: store.id,
        invitedEmail: normalizedEmail,
        invitedName: trimmedName,
        position: trimmedPosition,
        permissions: validPermissions,
        role,
        inviteToken: token,
        invitedByUserId: session.user.id,
      },
    });
  }

  try {
    await sendStaffInviteEmail(
      normalizedEmail,
      token,
      store.name,
      session.user.name ?? "The store owner",
      role,
      trimmedName,
      trimmedPosition,
      validPermissions
    );
  } catch {
    return { success: false, error: "Invite saved, but the email couldn't be sent. Try resending it." };
  }

  return { success: true, data: undefined };
}

export async function listStaffMembers(slug: string): Promise<
  ActionResult<
    {
      id: string;
      email: string;
      role: string;
      status: string;
      invitedAt: Date;
      name: string | null;
      position: string | null;
      permissions: string[];
    }[]
  >
> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const members = await prisma.storeStaff.findMany({
    where: { storeId: store.id },
    include: { user: true },
    orderBy: { invitedAt: "desc" },
  });

  return {
    success: true,
    data: members.map((m) => ({
      id: m.id,
      email: m.invitedEmail,
      role: m.role,
      status: m.status,
      invitedAt: m.invitedAt,
      name: m.user?.name ?? m.invitedName ?? null,
      position: m.position ?? null,
      permissions: m.permissions,
    })),
  };
}

export async function revokeStaffMember(slug: string, staffId: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const member = await prisma.storeStaff.findFirst({ where: { id: staffId, storeId: store.id } });
  if (!member) return { success: false, error: "Staff member not found." };

  await prisma.storeStaff.update({ where: { id: member.id }, data: { status: "REVOKED" } });

  if (member.userId) {
    await notifyUser({
      userId: member.userId,
      type: "STAFF_ACCESS_REVOKED",
      title: "Your access was removed",
      body: `Your access to ${store.name}'s dashboard has been revoked.`,
    });
  }

  return { success: true, data: undefined };
}

/**
 * Called from /staff/accept?token=... . Only links the invite to the
 * currently signed-in user if their account email matches the invited
 * email exactly — this is what stops someone from guessing/leaking a
 * token and claiming a staff seat meant for a different email address.
 */
export async function acceptStaffInvite(token: string): Promise<ActionResult<{ storeSlug: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in to accept this invite." };

  const invite = await prisma.storeStaff.findUnique({ where: { inviteToken: token }, include: { store: true } });
  if (!invite) return { success: false, error: "This invite link is invalid or has already been used." };
  if (invite.status === "REVOKED") return { success: false, error: "This invite has been revoked." };
  if (invite.status === "ACTIVE") return { success: false, error: "This invite has already been accepted." };

  if (invite.invitedEmail.toLowerCase() !== session.user.email?.toLowerCase()) {
    return {
      success: false,
      error: `This invite was sent to ${invite.invitedEmail}. Sign in with that email to accept it.`,
    };
  }

  await prisma.storeStaff.update({
    where: { id: invite.id },
    data: { userId: session.user.id, status: "ACTIVE", acceptedAt: new Date() },
  });

  return { success: true, data: { storeSlug: invite.store.slug } };
}
