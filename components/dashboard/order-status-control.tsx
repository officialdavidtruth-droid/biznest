"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions/order";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";

const NEXT_STATUSES: Record<string, OrderStatus[]> = {
  PAID: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  PENDING_PAYMENT: [],
  CANCELLED: [],
  REFUNDED: [],
  DISPUTED: [],
};

export function OrderStatusControl({
  storeSlug,
  orderId,
  currentStatus,
}: {
  storeSlug: string;
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const options = NEXT_STATUSES[currentStatus] ?? [];

  async function handleChange(status: OrderStatus) {
    setIsSubmitting(true);
    const result = await updateOrderStatus(storeSlug, orderId, status);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Order marked as ${status.replace("_", " ").toLowerCase()}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">
        Current: <strong>{currentStatus.replace("_", " ")}</strong>
      </span>
      {options.length > 0 && (
        <div className="flex gap-2">
          {options.map((status) => (
            <button
              key={status}
              disabled={isSubmitting}
              onClick={() => handleChange(status)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Mark as {status.replace("_", " ").toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
