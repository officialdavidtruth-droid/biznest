"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moderateAd } from "@/lib/actions/ads-admin";

export function AdminAdActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function act(a: "PAUSE" | "RESUME" | "REMOVE") {
    if (a === "REMOVE" && !confirm("Remove this ad for good? The business is told. Refund any unspent budget from the gateway dashboard.")) return;
    start(async () => {
      const r = await moderateAd(id, a);
      if (!r.success) { toast.error(r.error); return; }
      toast.success(a === "REMOVE" ? "Ad removed." : a === "PAUSE" ? "Ad paused." : "Ad running again.");
      router.refresh();
    });
  }
  if (status === "REMOVED") return null;
  return (
    <div className="mt-3 flex gap-2">
      {status === "ACTIVE" && <button disabled={pending} onClick={() => act("PAUSE")} className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60">Pause</button>}
      {status === "PAUSED" && <button disabled={pending} onClick={() => act("RESUME")} className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60">Resume</button>}
      <button disabled={pending} onClick={() => act("REMOVE")} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-60">Remove</button>
    </div>
  );
}
