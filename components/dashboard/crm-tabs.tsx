import Link from "next/link";

/** Section switcher shown at the top of the CRM & Sales app. */
export function CrmTabs({ slug, active }: { slug: string; active: "pipeline" | "marketing" }) {
  const tabs = [
    { id: "pipeline", label: "Pipeline & customers", href: `/store/${slug}/admin/apps/crm` },
    { id: "marketing", label: "Email marketing", href: `/store/${slug}/admin/apps/crm/marketing` },
  ] as const;
  return (
    <nav aria-label="CRM sections" className="flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${active === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
