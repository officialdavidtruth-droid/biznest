"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions/order";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";
import { merchantNextStatuses } from "@/lib/constants/order";

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
  const options = merchantNextStatuses(currentStatus);

  async function handleChange(status: OrderStatus) {
    setIsSubmitting(true);
    const result = await updateOrderStatus(storeSlug, orderId, status);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Order marked as ${status.replace(/_/g, " ").toLowerCase()}`);
    router.refresh();
  }

  const mustRefundToCancel = currentStatus === "PAID" || currentStatus === "IN_PROGRESS";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Current: <strong>{currentStatus.replace(/_/g, " ")}</strong>
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
                Mark as {status.replace(/_/g, " ").toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      {mustRefundToCancel && (
        <p className="mt-2 text-xs text-muted-foreground">
          Can&apos;t fulfil this order? Use <strong>Issue refund</strong> below. It returns the customer&apos;s money and closes the order.
        </p>
      )}
    </div>
  );
}
