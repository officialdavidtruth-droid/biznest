import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProfessionalServiceSubNicheByName } from "@/lib/professional-services";
import { resolveStoreTheme } from "@/lib/template-themes";
import { StartProjectForm } from "@/components/projects/start-project-form";

export default async function StartProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true, template: true } });
  if (!store) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const niche = getProfessionalServiceSubNicheByName(store.business.businessSubcategory);
  const services = niche?.services ?? ["Consultation", "Custom Service", "Project Work", "Other"];
  const accent = theme.accent || "#1473ea";
  const description = store.business.description || "Tell us what you need and we’ll prepare the right solution for you.";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f9fc", color: theme.ink, fontFamily: theme.font }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,.94)", backdropFilter: "blur(16px)", borderBottom: "1px solid #0b17250f" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", gap: 24 }}>
          <Link href={`/store/${slug}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "#111827", textDecoration: "none", fontWeight: 800 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "#111", color: "#fff", fontWeight: 900 }}>{store.name?.[0] || "B"}</span>
            <span>{store.name}</span>
          </Link>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 22, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
            {[["Home", ""], ["Services", "services"], ["About", "about"], ["Portfolio", "portfolio"], ["Pricing", "pricing"], ["Contact", "contact"]].map(([label, path]) => (
              <Link key={label} href={`/store/${slug}${path ? `/${path}` : ""}`} style={{ color: "#111827", textDecoration: "none" }}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section style={{ background: "linear-gradient(115deg,#061525,#122b46)", color: "#fff", padding: "90px 24px 100px" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto" }}>
            <Link href={`/store/${slug}`} style={{ color: "#ffffffb8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, marginBottom: 35 }}><ArrowLeft size={15} /> Back to {store.name}</Link>
            <small style={{ display: "block", color: accent, fontWeight: 900, letterSpacing: ".2em", fontSize: 11 }}>START A PROJECT</small>
            <h1 style={{ fontSize: "clamp(48px,7vw,92px)", lineHeight: .94, letterSpacing: "-.055em", margin: "16px 0 22px", maxWidth: 900 }}>Let’s bring your ideas to life.</h1>
            <p style={{ maxWidth: 650, color: "#ffffffb8", lineHeight: 1.8, fontSize: 16 }}>{description}</p>
          </div>
        </section>

        <section style={{ maxWidth: 1120, margin: "-45px auto 80px", padding: "0 24px", position: "relative" }}>
          <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 24px 70px #06152518", padding: "clamp(22px,4vw,44px)" }}>
            <StartProjectForm slug={slug} services={services} businessName={store.name} />
          </div>
        </section>
      </main>

      <footer style={{ background: "#061525", color: "#fff", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", fontSize: 12, color: "#ffffff99" }}>
          <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
          <Link href={`/store/${slug}`} style={{ color: "#fff", textDecoration: "none" }}>Back to homepage</Link>
        </div>
      </footer>
    </div>
  );
}
