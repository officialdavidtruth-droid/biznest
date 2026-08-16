"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptStaffInvite } from "@/lib/actions/staff";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    const result = await acceptStaffInvite(token);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("You're in!");
    router.push(`/store/${result.data.storeSlug}/admin`);
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      className="mt-6 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {loading ? "Joining…" : "Accept invite"}
    </button>
  );
}
