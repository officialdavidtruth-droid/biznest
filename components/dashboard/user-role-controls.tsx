"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole, deleteUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import type { UserRole } from "@prisma/client";

const ROLES: UserRole[] = ["CUSTOMER", "STORE_OWNER", "SUPPORT_MODERATOR", "PLATFORM_ADMIN"];

export function UserRoleSelect({ userId, role }: { userId: string; role: UserRole }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChange(next: UserRole) {
    if (next === role) return;
    if (!confirm(`Change this user's role from ${role} to ${next}?`)) return;

    setIsSubmitting(true);
    const result = await changeUserRole(userId, next);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Role updated to ${next}`);
    router.refresh();
  }

  return (
    <select
      defaultValue={role}
      disabled={isSubmitting}
      onChange={(e) => handleChange(e.target.value as UserRole)}
      className="rounded-md border bg-background px-2 py-1 text-xs disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;

    setIsSubmitting(true);
    const result = await deleteUser(userId);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User deleted");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
    >
      Delete
    </button>
  );
}
