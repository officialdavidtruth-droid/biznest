"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setSupportRequestStatus } from "@/lib/actions/support-request-admin";

export function AdminSupportRequestToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "OPEN" ? "RESOLVED" : "OPEN";

  function toggle() {
    startTransition(async () => {
      const r = await setSupportRequestStatus(id, next);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(next === "RESOLVED" ? "Marked resolved." : "Reopened.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      {next === "RESOLVED" ? "Mark resolved" : "Reopen"}
    </button>
  );
}
