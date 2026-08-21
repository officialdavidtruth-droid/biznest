"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { sendStaffInviteEmail } from "@/lib/email/send";
import { canManageBillingAndStaff, getStoreAccessRole } from "@/lib/access/store-access";
import { notifyUser } from "@/lib/notifications/notify";
import { STAFF_PERMISSION_IDS, labelForPermission } from "@/lib/access/staff-permissions";
import { logStoreActivity } from "@/lib/actions/activity";
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
  username: string,
  password: string,
  role: "MANAGER" | "STAFF",
  name: string,
  position: string,
  permissions: string[],
  email?: string
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, error: "Enter the staff member's name." };
  const trimmedPosition = position.trim();
  if (!trimmedPosition) return { success: false, error: "Enter the staff member's position." };

  // Login handle: letters, numbers, dots, underscores, hyphens only —
  // it becomes "username@store-slug" at sign-in, so keep it free of
  // spaces/@ so it can't be confused with a real email address.
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
    return {
      success: false,
      error: "Username must be 3-32 characters: letters, numbers, dots, underscores, or hyphens only.",
    };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const normalizedEmail = email?.trim().toLowerCase() || undefined;
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: "Enter a valid email address, or leave it blank." };
  }
  if (normalizedEmail && normalizedEmail === session.user.email?.toLowerCase()) {
    return { success: false, error: "You're already the owner of this store." };
  }

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

  const usernameClash = await prisma.storeStaff.findFirst({
    where: { storeId: store.id, username: { equals: normalizedUsername, mode: "insensitive" } },
  });
  if (usernameClash) {
    return { success: false, error: "That username is already taken at this store — pick another." };
  }

  // The User table requires a real, globally-unique, non-null email.
  // Staff sign in with username@store-slug regardless (see lib/auth.ts),
  // so a real email is optional here -- fall back to an internal
  // placeholder that can never collide with a real address or another
  // store's staff.
  const userEmail = normalizedEmail ?? `${normalizedUsername}.${store.slug}.staff@internal.biznest`;

  const emailClash = await prisma.user.findUnique({ where: { email: userEmail } });
  if (emailClash) {
    return {
      success: false,
      error: normalizedEmail
        ? "That email is already associated with another account."
        : "That username is already taken — pick another.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const token = nanoid(32);

  let staffUser;
  try {
    staffUser = await prisma.user.create({
      data: {
        name: trimmedName,
        email: userEmail,
        passwordHash,
        // Dashboard access for this account comes from the StoreStaff row's
        // role/permissions (see getStoreAccessRole), not from User.role --
        // CUSTOMER is just the harmless default for a non-owner account.
        role: "CUSTOMER",
      },
    });
  } catch {
    // Most likely a last-moment unique-constraint race on the email we just
    // checked above -- surface it as a normal ActionResult instead of an
    // unhandled throw, which would otherwise leave the client's "Creating
    // account..." button stuck forever with no feedback.
    return { success: false, error: "Couldn't create that account — the email or username may already be in use." };
  }

  await prisma.storeStaff.create({
    data: {
      storeId: store.id,
      invitedEmail: normalizedEmail,
      invitedName: trimmedName,
      position: trimmedPosition,
      username: normalizedUsername,
      permissions: validPermissions,
      role,
      inviteToken: token,
      invitedByUserId: session.user.id,
      userId: staffUser.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  if (normalizedEmail) {
    try {
      await sendStaffInviteEmail(
        normalizedEmail,
        store.name,
        session.user.name ?? "The store owner",
        role,
        trimmedName,
        trimmedPosition,
        validPermissions,
        normalizedUsername,
        store.slug,
        password
      );
    } catch {
      // Account still exists and works -- just flag that the email
      // didn't go out so the admin knows to hand over credentials another way.
      return {
        success: true,
        data: undefined,
      };
    }
  }

  await logStoreActivity({
    storeId: store.id,
    actor: { id: session.user.id, name: session.user.name, email: session.user.email, role: "OWNER" },
    action: "staff.invited",
    target: normalizedUsername,
    metadata: { role, position: trimmedPosition, permissions: validPermissions },
  });

  return { success: true, data: undefined };
}

export async function listStaffMembers(slug: string): Promise<
  ActionResult<
    {
      id: string;
      email: string | null;
      username: string | null;
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
      username: m.username,
      role: m.role,
      status: m.status,
      invitedAt: m.invitedAt,
      name: m.user?.name ?? m.invitedName ?? null,
      position: m.position ?? null,
      permissions: m.permissions,
    })),
  };
}

export async function updateStaffAccess(
  slug: string,
  staffId: string,
  role: "MANAGER" | "STAFF",
  permissions: string[]
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const validPermissions = permissions.filter((p) => STAFF_PERMISSION_IDS.includes(p as (typeof STAFF_PERMISSION_IDS)[number]));
  if (validPermissions.length === 0) {
    return { success: false, error: "Select at least one area they should have access to." };
  }

  const member = await prisma.storeStaff.findFirst({ where: { id: staffId, storeId: store.id } });
  if (!member) return { success: false, error: "Staff member not found." };
  if (member.status === "REVOKED") return { success: false, error: "This person's access has been revoked." };

  await prisma.storeStaff.update({
    where: { id: member.id },
    data: { role, permissions: validPermissions },
  });

  await logStoreActivity({
    storeId: store.id,
    actor: { id: session.user.id, name: session.user.name, email: session.user.email, role: "OWNER" },
    action: "staff.access_updated",
    target: member.invitedEmail ?? undefined,
    metadata: { role, permissions: validPermissions },
  });

  if (member.userId) {
    await notifyUser({
      userId: member.userId,
      type: "STAFF_ACCESS_UPDATED",
      title: "Your access was updated",
      body: `Your access to ${store.name}'s dashboard is now: ${validPermissions.map(labelForPermission).join(", ")}.`,
    });
  }

  return { success: true, data: undefined };
}

export async function revokeStaffMember(slug: string, staffId: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const { store, error } = await requireOwner(slug, session.user.id, session.user.role);
  if (!store) return { success: false, error: error! };

  const member = await prisma.storeStaff.findFirst({ where: { id: staffId, storeId: store.id } });
  if (!member) return { success: false, error: "Staff member not found." };

  await prisma.storeStaff.update({ where: { id: member.id }, data: { status: "REVOKED" } });

  await logStoreActivity({
    storeId: store.id,
    actor: { id: session.user.id, name: session.user.name, email: session.user.email, role: "OWNER" },
    action: "staff.removed",
    target: member.invitedEmail ?? undefined,
  });

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

  // Legacy invites only (new invites are created ACTIVE immediately via
  // inviteStaffMember and never reach this function) -- invitedEmail is
  // guaranteed non-null on any row that's still PENDING, since the
  // optional-email path only exists on invites created after this switch,
  // which are ACTIVE from the start. The null check is just to satisfy
  // the now-nullable column type.
  if (!invite.invitedEmail || invite.invitedEmail.toLowerCase() !== session.user.email?.toLowerCase()) {
    return {
      success: false,
      error: invite.invitedEmail
        ? `This invite was sent to ${invite.invitedEmail}. Sign in with that email to accept it.`
        : "This invite can no longer be accepted this way.",
    };
  }

  await prisma.storeStaff.update({
    where: { id: invite.id },
    data: { userId: session.user.id, status: "ACTIVE", acceptedAt: new Date() },
  });

  await logStoreActivity({
    storeId: invite.storeId,
    actor: { id: session.user.id, name: session.user.name, email: session.user.email, role: invite.role },
    action: "staff.joined",
    target: invite.invitedEmail ?? undefined,
  });

  return { success: true, data: { storeSlug: invite.store.slug } };
}
