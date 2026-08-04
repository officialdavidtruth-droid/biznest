"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { banUser, unbanUser } from "@/lib/actions/admin";
import { toast } from "sonner";

export function UserBanButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    let reason = "";
    if (!isBanned) {
      const input = prompt("Reason for banning this user (shown in audit log):");
      if (input === null) return; // cancelled
      reason = input;
    } else if (!confirm("Unban this user?")) {
      return;
    }

    setIsSubmitting(true);
    const result = isBanned ? await unbanUser(userId) : await banUser(userId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isBanned ? "User unbanned" : "User banned");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className={`text-xs font-medium hover:underline disabled:opacity-50 ${
        isBanned ? "text-primary" : "text-destructive"
      }`}
    >
      {isBanned ? "Unban" : "Ban"}
    </button>
  );
}
