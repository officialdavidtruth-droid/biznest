"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { suspendStore, reinstateStoreStatus } from "@/lib/actions/admin";
import { toast } from "sonner";

export function StoreStatusButton({ storeId, status }: { storeId: string; status: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    const isActive = status === "ACTIVE";
    if (!confirm(isActive ? "Suspend this store?" : "Reinstate this store?")) return;

    setIsSubmitting(true);
    const result = isActive ? await suspendStore(storeId) : await reinstateStoreStatus(storeId);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Done");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className={`text-xs font-medium hover:underline disabled:opacity-50 ${
        status === "ACTIVE" ? "text-destructive" : "text-primary"
      }`}
    >
      {status === "ACTIVE" ? "Suspend" : "Reinstate"}
    </button>
  );
}
