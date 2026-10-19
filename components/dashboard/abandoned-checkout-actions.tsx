"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendAbandonedCheckoutRecovery, type RecoveryChannel } from "@/lib/actions/abandoned-checkout";
import { toast } from "sonner";

const CHANNELS: { value: RecoveryChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export function AbandonedCheckoutActions({ slug, orderId }: { slug: string; orderId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState<RecoveryChannel | null>(null);

  async function handleSend(channel: RecoveryChannel) {
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
    <div className="flex flex-wrap gap-2">
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
