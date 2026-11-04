"use client";

import type { ReactNode } from "react";
import type { BuilderConfig } from "@/lib/builder-config";
import type { SubpageStore } from "@/components/storefront/builder-subpages";
import { Shell } from "@/components/storefront/blog-views";

/**
 * The Builder's header and footer around a page that has none of its own (product, service, cart, blog).
 * Used when the store's home page is drawn by the Builder, so the shopper never meets a different header.
 */
export function BuilderPageShell({ store, design, children }: { store: SubpageStore; design: BuilderConfig["design"]; children: ReactNode }) {
  return <Shell store={store} design={design} crumbs={[]}>{children}</Shell>;
}
