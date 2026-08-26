import Link from "next/link";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { DEMO_STORES } from "@/lib/demo-stores";
import type { TemplateTheme } from "@/lib/template-themes";

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
            Each option below is rendered from the same production storefront component used by BizNest — not a shape mockup.
            Open a full preview to inspect the actual front page; selected templates can then be applied to your store.
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
              <div className="relative h-44 overflow-hidden bg-white">
                <iframe
                  title={`${t.name} live front page preview`}
                  src={`/template-preview/${encodeURIComponent(t.name)}`}
                  className="pointer-events-none absolute left-0 top-0 h-[300%] w-[300%] origin-top-left scale-[.333333] border-0 bg-white"
                  loading="lazy"
                  tabIndex={-1}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-xs font-semibold text-white drop-shadow">{t.name}</span>
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
                    href={demoSlug ? `/${demoSlug}` : `/template-preview/${encodeURIComponent(t.name)}`}
                    target="_blank"
                    className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
                    style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}
                  >
                    {demoSlug ? "View live demo →" : "Open full preview →"}
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

        {templates.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed p-12 text-center text-sm opacity-70" style={{ borderColor: "var(--bn-ink-line)" }}>
            No templates are set up yet — run <code>npm run db:seed</code> against your database.
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
