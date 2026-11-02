import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { formatPublicSalary, jobAcceptsApplications } from "@/lib/recruitment-public";
import { CareersApplyForm } from "@/components/storefront/careers-apply-form";
import { cleanDescription, NO_INDEX } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ job?: string }> };

const TYPE_LABEL: Record<string, string> = { FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", TEMPORARY: "Temporary", INTERNSHIP: "Internship" };

/** The store, only if it's live and has Recruitment installed — otherwise the page doesn't exist. */
async function loadCareers(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, status: true, marketingOnly: true, seoNoIndex: true, currency: true } });
  if (!store || store.status !== "ACTIVE") return null;
  const ent = await getPluginEntitlement(store.id, "recruitment-ats");
  if (!ent.allowed || !ent.installed) return null;
  const rows = await prisma.recruitJob.findMany({
    where: { storeId: store.id, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, department: true, location: true, employmentType: true, description: true, requirements: true, status: true, closesAt: true, showSalary: true, salaryMin: true, salaryMax: true },
  });
  return { store, jobs: rows.filter((j) => jobAcceptsApplications(j)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await loadCareers(slug);
  if (!c) return { robots: NO_INDEX };
  return {
    title: `Careers | ${c.store.name}`,
    description: cleanDescription(`Open positions at ${c.store.name}. Apply online.`),
    robots: c.store.marketingOnly || c.store.seoNoIndex ? NO_INDEX : undefined,
  };
}

export default async function CareersPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { job: jobParam } = await searchParams;
  const c = await loadCareers(slug);
  if (!c) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{c.store.name}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Careers</h1>
      <p className="mt-2 text-sm text-muted-foreground">Browse our open positions and apply online.</p>

      {c.jobs.length === 0 ? (
        <p className="mt-8 rounded-xl border p-6 text-sm text-muted-foreground">There are no open positions right now. Please check back soon.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {c.jobs.map((j) => {
            const salary = j.showSalary ? formatPublicSalary(j.salaryMin == null ? null : Number(j.salaryMin), j.salaryMax == null ? null : Number(j.salaryMax), c.store.currency) : null;
            return (
            <details key={j.id} open={jobParam === j.id} className="rounded-xl border p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer list-none">
                <h2 className="text-lg font-bold">{j.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[j.department, j.location, TYPE_LABEL[j.employmentType] ?? j.employmentType, salary].filter(Boolean).join(" · ")}
                  {j.closesAt ? ` · Apply by ${j.closesAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}
                </p>
              </summary>
              <div className="mt-4 space-y-4 text-sm">
                {j.description && <div><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About the role</h3><p className="mt-1 whitespace-pre-line">{j.description}</p></div>}
                {j.requirements && <div><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Requirements</h3><p className="mt-1 whitespace-pre-line">{j.requirements}</p></div>}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-bold">Apply for this role</h3>
                  <CareersApplyForm slug={slug} jobId={j.id} jobTitle={j.title} />
                </div>
              </div>
            </details>
            );
          })}
        </div>
      )}
    </main>
  );
}
