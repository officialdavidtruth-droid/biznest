import Link from "next/link";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { DEMO_STORES } from "@/lib/demo-stores";
import type { TemplateTheme } from "@/lib/template-themes";
import { TemplateCover } from "@/components/storefront/template-cover";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Templates — BizNest",
  description: "Browse every BizNest storefront template and click through a fully functional live demo before you build.",
};

function themeFromConfig(config: unknown): TemplateTheme | null {
  const c = config as Partial<TemplateTheme> | null;
  if (!c || typeof c !== "object" || !c.bg) return null;
  return c as TemplateTheme;
}

export default async function TemplatesPage() {
  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: { tierRank: "asc" },
  });

  const demoBySlugTemplate = new Map(DEMO_STORES.map((d) => [d.templateName, d.slug]));

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
          const theme = themeFromConfig(t.config);
          const demoSlug = demoBySlugTemplate.get(t.name);
          if (!theme) return null;

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
                  {demoSlug ? (
                    <Link
                      href={`/store/${demoSlug}`}
                      target="_blank"
                      className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
                      style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}
                    >
                      View live demo →
                    </Link>
                  ) : (
                    <span className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-medium opacity-50">
                      Demo coming soon
                    </span>
                  )}
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

        {templates.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed p-12 text-center text-sm opacity-70" style={{ borderColor: "var(--bn-ink-line)" }}>
            No templates are set up yet — run <code>npm run db:seed</code> then <code>npm run db:seed:demos</code> against your database.
          </div>
        )}
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
