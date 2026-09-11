"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { installFreePlugin, startPluginPurchase } from "@/lib/actions/plugins";

export function PluginUseButton({ slug, pluginKey, isFree, installed }: { slug: string; pluginKey: string; isFree: boolean; installed: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (installed) {
    return <button onClick={() => router.push(pluginKey === "pms" ? `/store/${slug}/admin/pms` : `/store/${slug}/admin/apps/${pluginKey}`)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Open app</button>;
  }

  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const result = isFree ? await installFreePlugin(slug, pluginKey) : await startPluginPurchase(slug, pluginKey);
        if (result.success && "authorizationUrl" in result.data) window.location.href = result.data.authorizationUrl;
        else if (result.success) router.refresh();
        else window.alert(result.error);
      })}
      className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
    >
      {pending ? "Starting…" : isFree ? "Use app" : "Get app"}
    </button>
  );
}
