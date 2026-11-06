"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveBrowseReport } from "@/lib/actions/browse-admin";

export function AdminBrowseReportDecision({ targetKey, kind }: { targetKey: string; kind: "post" | "comment" | "story" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function decide(d: "UPHOLD" | "DISMISS") {
    if (d === "UPHOLD" && !confirm(kind === "post" ? "Remove this post from Browse? The store is told." : kind === "story" ? "Remove this story?" : "Hide this comment?")) return;
    start(async () => {
      const r = await resolveBrowseReport(targetKey, d);
      if (!r.success) { toast.error(r.error); return; }
      toast.success(d === "UPHOLD" ? (kind === "post" ? "Post removed." : kind === "story" ? "Story removed." : "Comment hidden.") : "Reports dismissed.");
      router.refresh();
    });
  }
  return (
    <div className="mt-3 flex gap-2">
      <button disabled={pending} onClick={() => decide("UPHOLD")} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-60">{kind === "post" ? "Remove post" : kind === "story" ? "Remove story" : "Hide comment"}</button>
      <button disabled={pending} onClick={() => decide("DISMISS")} className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60">Keep it</button>
    </div>
  );
}
