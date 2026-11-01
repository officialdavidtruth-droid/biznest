"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { installFreePlugin, startPluginPurchase } from "@/lib/actions/plugins";

export function PluginUseButton({ slug, pluginKey, isFree, installed, renewalDue = false }: { slug: string; pluginKey: string; isFree: boolean; installed: boolean; renewalDue?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (installed) {
    const standalone = pluginKey === "pms" || pluginKey === "fnb-operations";
    const dedicatedHref = pluginKey === "pms" ? `/store/${slug}/admin/pms` : pluginKey === "fnb-operations" ? `/store/${slug}/admin/fnb` : pluginKey === "travel-agency" ? `/store/${slug}/admin/travel` : null;
    const open = <button onClick={() => standalone && dedicatedHref ? window.location.assign(dedicatedHref) : router.push(dedicatedHref ?? `/store/${slug}/admin/apps/${pluginKey}`)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Open app</button>;
    if (!renewalDue) return open;
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const result = await startPluginPurchase(slug, pluginKey, { renew: true });
            if (result.success && "authorizationUrl" in result.data) window.location.href = result.data.authorizationUrl;
            else if (!result.success) window.alert(result.error);
          })}
          className="rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary disabled:opacity-50"
        >
          {pending ? "Starting…" : "Renew"}
        </button>
        {open}
      </div>
    );
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
