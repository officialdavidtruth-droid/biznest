import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { pageSkinAt, type PageSkin } from "@/lib/storefront/page-skin";

// Server-only: reads the registry. Client code gets the resolved skin through the palette.
let order: string[] | null = null;
const names = () => (order ??= PUBLIC_TEMPLATE_REGISTRY.map((t) => t.name).sort());

export function pageSkinFor(templateName: string | null | undefined): PageSkin {
  const i = templateName ? names().indexOf(templateName) : -1;
  return pageSkinAt(i < 0 ? 0 : i);
}
