"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveHumanRequest } from "@/lib/actions/store-chat";

export function ResolveHumanButton({ slug, conversationId }: { slug: string; conversationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resolveHumanRequest(slug, conversationId);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          router.refresh();
        })
      }
      className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
    >
      {pending ? "…" : "Mark handled"}
    </button>
  );
}
