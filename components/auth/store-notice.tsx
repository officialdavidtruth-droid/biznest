import Link from "next/link";
import type { ReactNode } from "react";
import { isDarkColor, readableOn } from "@/lib/storefront/readable-design";

export type NoticeStore = { name: string; slug: string; logoUrl: string | null; color: string | null } | null;

export function pickStoreColor(themeColors: unknown): string | null {
  const c = (themeColors as { primary?: string } | null)?.primary;
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null;
}

/**
 * Centered status card for customer-facing result pages (email verified,
 * unsubscribe). Shows the store's own logo, name and colour; only falls back
 * to neutral styling (never BizNest branding) when no store is known.
 */
export function StoreNotice({
  store,
  title,
  body,
  tone = "ok",
  children,
}: {
  store: NoticeStore;
  title: string;
  body: string;
  tone?: "ok" | "warn" | "mail";
  children?: ReactNode;
}) {
  const color = store?.color ?? "#1f2937";
  const on = readableOn(color);
  const icon = tone === "ok" ? "✓" : tone === "mail" ? "✉" : "!";
  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: `${color}14` }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white text-center shadow-sm">
        <div className="px-6 py-5" style={{ background: color, color: on }}>
          {store?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="mx-auto h-12 w-auto max-w-[200px] object-contain" />
          ) : store ? (
            <span className="text-lg font-semibold">{store.name}</span>
          ) : null}
          {store?.logoUrl && <p className="mt-2 text-sm font-semibold">{store.name}</p>}
        </div>
        <div className="p-8">
          <div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full text-lg"
            style={{ background: `${color}22`, color: isDarkColor(color) ? color : "#111827" }}
          >
            {icon}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

export function StoreButtonLink({ href, color, children }: { href: string; color: string | null; children: ReactNode }) {
  const c = color ?? "#1f2937";
  return (
    <Link href={href} className="mt-6 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold" style={{ background: c, color: readableOn(c) }}>
      {children}
    </Link>
  );
}
