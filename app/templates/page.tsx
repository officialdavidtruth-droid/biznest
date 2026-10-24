import Link from "next/link";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import type { TemplateTheme } from "@/lib/template-themes";
import { TemplateCover } from "@/components/storefront/template-cover";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Templates — BizNest",
  description: "Browse every BizNest storefront template and click through a fully functional live demo before you build.",
};

export default async function TemplatesPage() {
  // The registry is the single source of truth for the public catalog (same list the seed activates),
  // so this page can never drift from, or depend on, what happens to be in the database.
  const templates = [...PUBLIC_TEMPLATE_REGISTRY]
    .map((d) => ({ id: d.id, name: d.name, category: d.category, tierRank: (d.theme as { tierRank?: number }).tierRank ?? 1, theme: d.theme as unknown as TemplateTheme }))
    .sort((a, b) => a.tierRank - b.tierRank || a.name.localeCompare(b.name));

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen`}
      style={{ background: "var(--bn-hero-gradient)", color: "var(--bn-ivory)", fontFamily: "var(--font-body)" }}
    >
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="text-lg tracking-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--bn-ivory)", textDecoration: "none" }}>
          BizNest
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          <Link href="/login" className="opacity-80 transition hover:opacity-100">Sign in</Link>
          <Link
            href="/register"
            className="rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
            style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}
          >
            Open your store
          </Link>
        </nav>
      </header>

      <section className="px-6 pb-10 pt-8 sm:px-10 lg:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700 }} className="text-3xl sm:text-5xl">
            Every template. Fully working. Nothing faked.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm opacity-80 sm:text-base">
            Each option below is a real, live storefront — real catalog, real cart, real checkout flow — not a screenshot.
            Click through the whole journey before you build your own.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:px-10 lg:grid-cols-3">
        {templates.map((t) => {
          const theme = t.theme;

          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: "var(--bn-ink-line)", background: "var(--bn-ink-raised)" }}
            >
              <div className="relative h-44 overflow-hidden" style={{ background: theme.bg }}>
                {/* Static facsimile built from the template's own theme
                    tokens (WordPress-style theme thumbnail) — always
                    renders correctly, not dependent on a seeded demo store. */}
                <TemplateCover theme={theme} />
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700 }} className="text-lg">
                    {t.name}
                  </h2>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}>
                    {TIER_LABEL[t.tierRank] ?? "Free"}
                  </span>
                </div>
                <p className="mt-2 text-sm opacity-70">{t.category}</p>
                <p className="mt-1 text-xs opacity-60">Layout: {theme.heroStyle}</p>

                <div className="mt-5 flex items-center gap-3">
                  <Link
                    href={`/template-preview/${encodeURIComponent(t.name)}`}
                    target="_blank"
                    className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
                    style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}
                  >
                    View live demo →
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-full border px-4 py-2.5 text-center text-sm font-medium transition hover:opacity-80"
                    style={{ borderColor: "var(--bn-ink-line)" }}
                  >
                    Use this
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

      </section>
    </div>
  );
}

const TIER_LABEL: Record<number, string> = {
  1: "Free",
  2: "Entrepreneur",
  3: "Enterprise",
  4: "Business Mogul",
};
