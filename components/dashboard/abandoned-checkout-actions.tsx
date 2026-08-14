"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendAbandonedCheckoutRecovery } from "@/lib/actions/abandoned-checkout";
import type { NotificationChannel } from "@prisma/client";
import { toast } from "sonner";

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" },
];

export function AbandonedCheckoutActions({ slug, orderId }: { slug: string; orderId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState<NotificationChannel | null>(null);

  async function handleSend(channel: NotificationChannel) {
    setSending(channel);
    const result = await sendAbandonedCheckoutRecovery(slug, orderId, channel);
    setSending(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Recovery message sent via ${channel === "WHATSAPP" ? "WhatsApp" : channel.toLowerCase()}.`);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {CHANNELS.map((c) => (
        <button
          key={c.value}
          onClick={() => handleSend(c.value)}
          disabled={sending !== null}
          className="rounded-full border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {sending === c.value ? "Sending…" : `Send ${c.label}`}
        </button>
      ))}
    </div>
  );
}
