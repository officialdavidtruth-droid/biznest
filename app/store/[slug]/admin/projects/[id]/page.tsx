import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreativeProjectPublic } from "@/lib/actions/creative-projects";
import { ProjectReviewActions } from "@/components/projects/project-review-actions";

export default async function StoreProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token = "" } = await searchParams;
  const project = await getCreativeProjectPublic(id, token);
  if (!project) notFound();

  const latest = project.revisions[0];
  const colors = (project.store.themeColors as { primary?: string; accent?: string } | null) ?? {};
  const accent = colors.primary || colors.accent || "#1473ea";
  const status = project.status.replaceAll("_", " ");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href={`/store/${project.store.slug}`} className="flex items-center gap-3 font-bold no-underline">
            {project.store.logoUrl ? (
              <img src={project.store.logoUrl} alt={project.store.name} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">{project.store.name?.[0] || "B"}</span>
            )}
            <span className="text-slate-950">{project.store.name}</span>
          </Link>
          <Link href={`/store/${project.store.slug}`} className="text-sm font-semibold text-slate-600 no-underline hover:text-slate-950">
            Back to website
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="px-6 py-10 sm:px-10 sm:py-14">
            <div className="mb-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[.18em] text-white/70">
              Project submitted
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Your project is now with {project.store.name}.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
              Keep this page. It is your secure project link for checking updates, reviewing designs and responding to the business.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-4 py-2 font-semibold">Project {project.projectNo}</span>
              <span className="rounded-full px-4 py-2 font-semibold text-white" style={{ background: accent }}>{status}</span>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Project brief</p>
            <h2 className="mt-2 text-2xl font-bold">{project.serviceType}</h2>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">{project.brief}</p>
            {latest && (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">Latest design · Version {latest.version}</p>
                  <span className="text-xs text-slate-400">{status}</span>
                </div>
                <img src={latest.previewUrl} alt={`Project ${project.projectNo} version ${latest.version}`} className="w-full rounded-2xl border border-slate-200 object-contain" />
                {latest.note && <p className="mt-3 text-sm leading-6 text-slate-500">{latest.note}</p>}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Submission</p>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-slate-400">Customer</dt><dd className="mt-1 font-semibold">{project.customerName}</dd></div>
                {project.customerEmail && <div><dt className="text-slate-400">Email</dt><dd className="mt-1 font-semibold break-all">{project.customerEmail}</dd></div>}
                {project.customerPhone && <div><dt className="text-slate-400">Phone</dt><dd className="mt-1 font-semibold">{project.customerPhone}</dd></div>}
                {project.budget && <div><dt className="text-slate-400">Budget</dt><dd className="mt-1 font-semibold">₦{project.budget.toLocaleString()}</dd></div>}
                {project.deadline && <div><dt className="text-slate-400">Deadline</dt><dd className="mt-1 font-semibold">{new Date(project.deadline).toLocaleDateString("en-NG")}</dd></div>}
              </dl>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7">
              <p className="text-sm font-bold">Need to make a change?</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Use the project page when a design is sent for approval. You can approve it or request changes without losing this project link.</p>
              <ProjectReviewActions projectId={project.id} token={token} status={project.status} />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
