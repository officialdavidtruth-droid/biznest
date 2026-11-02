"use client";

import { CV_ACCEPT, CV_ALLOWED_TYPES, CV_MAX_BYTES, CV_TYPE_HINT, cvViewHref } from "@/lib/recruitment-cv";
import { careersPath } from "@/lib/recruitment-public";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Briefcase, CalendarClock, Plus, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import {
  getRecruitmentDashboard, createRecruitJob, setRecruitJobStatus, deleteRecruitJob,
  createRecruitCandidate, deleteRecruitCandidate, applyCandidateToJob,
  moveApplicationStage, updateApplicationReview, setRecruitJobShowSalary,
} from "@/lib/actions/recruitment";
import { PIPELINE_STAGES, JOB_STATUSES, EMPLOYMENT_TYPES, RECRUIT_STAGES } from "@/lib/recruitment-constants";
import { formatMoney } from "@/lib/utils/format-money";

type Data = Exclude<Awaited<ReturnType<typeof getRecruitmentDashboard>>, { error: string }>;
type App = Data["applications"][number];
type Tab = "overview" | "pipeline" | "jobs" | "candidates";
type Modal = null | "job" | "candidate" | { kind: "app"; id: string } | { kind: "apply"; candidateId: string };

const input = "rounded-lg border bg-background px-3 py-2 text-sm";
const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const day = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const when = (d: Date | string) => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const TONE: Record<string, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-600", HIRED: "bg-emerald-500/10 text-emerald-600", FILLED: "bg-emerald-500/10 text-emerald-600",
  DRAFT: "bg-muted text-muted-foreground", CLOSED: "bg-muted text-muted-foreground", WITHDRAWN: "bg-muted text-muted-foreground",
  ON_HOLD: "bg-amber-500/10 text-amber-600", SCREENING: "bg-amber-500/10 text-amber-600", OFFER: "bg-violet-500/10 text-violet-600",
  INTERVIEW: "bg-sky-500/10 text-sky-600", APPLIED: "bg-muted text-muted-foreground", REJECTED: "bg-red-500/10 text-red-600",
};
const Pill = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${TONE[s] ?? "bg-muted"}`}>{label(s)}</span>;

function Metric({ icon: Icon, label: l, value, sub }: { icon: typeof Users; label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{l}</span><Icon className="h-4 w-4 text-primary" /></div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <div className="mt-3 rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">{children}</div>;
const Field = ({ l, children }: { l: string; children: ReactNode }) => <label className="grid gap-1 text-xs font-semibold">{l}{children}</label>;

export function RecruitmentWorkspace({ slug, data }: { slug: string; data: Data }) {
  const [d, setD] = useState<Data>(data);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [jobFilter, setJobFilter] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");
  // Stage changes that need extra detail (interview time, offer, rejection reason).
  const [stageDraft, setStageDraft] = useState<{ id: string; stage: string } | null>(null);

  const refresh = async () => {
    const r = await getRecruitmentDashboard(slug);
    if ("error" in r) setMsg(r.error ?? "Could not refresh"); else setD(r);
  };
  const run = (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.success) { setMsg(r.error || "Something went wrong"); return; }
      const note = (r.data as { note?: string } | undefined)?.note;
      setMsg(""); setNotice(note ?? ""); onOk?.(); await refresh();
    });

  const pipelineApps = d.applications.filter((a) => !jobFilter || a.jobId === jobFilter);
  const openJobs = d.jobs.filter((j) => j.status === "OPEN" || j.status === "ON_HOLD" || j.status === "DRAFT");
  const modalApp: App | undefined = modal && typeof modal === "object" && modal.kind === "app" ? d.applications.find((a) => a.id === modal.id) : undefined;

  const submitJob = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget;
    run(() => createRecruitJob(slug, new FormData(form)), () => { setModal(null); form.reset(); });
  };
  // Private (uploaded) CVs open through the staff-only viewer; plain links open directly.
  const cvHref = (c: { id: string; cvUrl: string | null }) => (c.cvUrl && /^https?:\/\//i.test(c.cvUrl) ? c.cvUrl : cvViewHref(slug, c.id));
  const submitCandidate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("cvFile");
    fd.delete("cvFile");
    start(async () => {
      if (file instanceof File && file.size > 0) {
        if (!CV_ALLOWED_TYPES.has(file.type)) { setMsg(`Unsupported CV type. Use ${CV_TYPE_HINT}.`); return; }
        if (file.size > CV_MAX_BYTES) { setMsg("The CV must be 4MB or smaller."); return; }
        const up = new FormData(); up.set("file", file);
        try {
          const res = await fetch(`/api/store/${slug}/recruitment/cv-upload`, { method: "POST", body: up });
          const j = await res.json().catch(() => ({}));
          if (!res.ok || !j.url) { setMsg(j.error || "The CV couldn't be uploaded."); return; }
          fd.set("cvUrl", j.url); // an uploaded file wins over a pasted link
        } catch { setMsg("The CV couldn't be uploaded. Check your connection and try again."); return; }
      }
      const r = await createRecruitCandidate(slug, fd);
      if (!r.success) { setMsg(r.error || "Something went wrong"); return; }
      setMsg(""); setNotice(""); setModal(null); form.reset(); await refresh();
    });
  };
  const changeStage = (a: App, stage: string) => {
    if (stage === a.stage) return;
    if (stage === "INTERVIEW" || stage === "OFFER" || stage === "REJECTED" || stage === "HIRED") { setStageDraft({ id: a.id, stage }); return; }
    run(() => moveApplicationStage(slug, a.id, stage));
  };
  const submitStageDraft = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!stageDraft) return; const f = new FormData(e.currentTarget);
    run(
      () => moveApplicationStage(slug, stageDraft.id, stageDraft.stage, {
        interviewAt: String(f.get("interviewAt") || ""), offerAmount: String(f.get("offerAmount") || ""), rejectionReason: String(f.get("rejectionReason") || ""), startDate: String(f.get("startDate") || ""),
      }),
      () => setStageDraft(null),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest Recruitment</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Applicant tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage job openings, your talent pool and every application from first contact to hire.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal("job")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />Job opening</button>
          <button onClick={() => setModal("candidate")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><UserPlus className="h-3.5 w-3.5" />Candidate</button>
        </div>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-2.5 text-xs text-[var(--bn-admin-danger)]">
          <span>{msg}</span><button onClick={() => setMsg("")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700">
          <span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Briefcase} label="Open jobs" value={d.openJobs} sub="Accepting candidates" />
        <Metric icon={Users} label="Talent pool" value={d.candidates.length} sub="Candidates on file" />
        <Metric icon={CalendarClock} label="Active applications" value={d.activeApplications} sub="Still in the process" />
        <Metric icon={UserCheck} label="Placements" value={d.hiredCount} sub="Candidates hired" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {(["overview", "pipeline", "jobs", "candidates"] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${tab === x ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{label(x)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-bold">Pipeline by stage</h2>
            <div className="mt-3 space-y-2">
              {RECRUIT_STAGES.map((s) => (
                <div key={s} className="flex items-center gap-3 rounded-lg border p-2.5 text-xs"><Pill s={s} /><span className="ml-auto font-bold">{d.stageCounts[s]}</span></div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-bold">Upcoming interviews</h2>
            <div className="mt-3 space-y-2">
              {d.upcomingInterviews.map((a) => (
                <button key={a.id} onClick={() => setModal({ kind: "app", id: a.id })} className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-xs">
                  <span><span className="font-semibold">{a.candidate.firstName} {a.candidate.lastName}</span><span className="block text-muted-foreground">{a.job.title}</span></span>
                  <span className="ml-auto text-muted-foreground">{when(a.interviewAt!)}</span>
                </button>
              ))}
              {!d.upcomingInterviews.length && <p className="text-xs text-muted-foreground">No interviews scheduled.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === "pipeline" && (
        <section className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Hiring pipeline</h2>
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className={input}>
              <option value="">All jobs</option>
              {d.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.clientName ? ` · ${j.clientName}` : ""}</option>)}
            </select>
          </div>
          {pipelineApps.length ? (
            <div className="mt-4 grid gap-3 overflow-x-auto md:grid-cols-5">
              {PIPELINE_STAGES.map((stage) => {
                const col = pipelineApps.filter((a) => a.stage === stage);
                return (
                  <div key={stage} className="min-w-[180px] rounded-lg bg-muted/40 p-2">
                    <div className="mb-2 flex items-center justify-between px-1"><Pill s={stage} /><span className="text-[11px] font-bold">{col.length}</span></div>
                    <div className="space-y-2">
                      {col.map((a) => (
                        <div key={a.id} className="rounded-lg border bg-background p-2.5 text-xs">
                          <button onClick={() => setModal({ kind: "app", id: a.id })} className="text-left font-semibold">{a.candidate.firstName} {a.candidate.lastName}</button>
                          <p className="mt-0.5 text-muted-foreground">{a.job.title}</p>
                          {a.rating && <p className="mt-1 text-amber-500">{"★".repeat(a.rating)}<span className="text-muted-foreground/40">{"★".repeat(5 - a.rating)}</span></p>}
                          <select disabled={pending} value={a.stage} onChange={(e) => changeStage(a, e.target.value)} className="mt-2 w-full rounded border bg-background px-1.5 py-1 text-[11px]">
                            {RECRUIT_STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>No applications yet. Add a candidate and attach them to a job to start the pipeline.</Empty>}
          {pipelineApps.some((a) => a.stage === "REJECTED" || a.stage === "WITHDRAWN") && (
            <p className="mt-3 text-[11px] text-muted-foreground">{pipelineApps.filter((a) => a.stage === "REJECTED").length} rejected and {pipelineApps.filter((a) => a.stage === "WITHDRAWN").length} withdrawn applications are hidden from the board. Find them under Candidates.</p>
          )}
        </section>
      )}

      {tab === "jobs" && (
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Job openings</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Open jobs are published on your <a href={careersPath(slug)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">public careers page</a>; applicants land in your pipeline as Applied.</p>
            </div>
            <button onClick={() => setModal("job")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add job</button>
          </div>
          {d.jobs.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="text-muted-foreground"><tr><th className="py-2 pr-3 font-semibold">Role</th><th className="pr-3 font-semibold">Client</th><th className="pr-3 font-semibold">Location</th><th className="pr-3 font-semibold">Salary</th><th className="pr-3 font-semibold">Applicants</th><th className="pr-3 font-semibold">Filled</th><th className="font-semibold">Status</th></tr></thead>
                <tbody>
                  {d.jobs.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="py-2.5 pr-3 font-semibold">{j.title}<span className="block font-normal text-muted-foreground">{label(j.employmentType)}{j.closesAt ? ` · closes ${day(j.closesAt)}` : ""}</span></td>
                      <td className="pr-3">{j.clientName || "—"}</td><td className="pr-3">{j.location || "—"}</td>
                      <td className="pr-3">{j.salaryMin != null || j.salaryMax != null ? (
                        <>
                          {`${j.salaryMin != null ? formatMoney(j.salaryMin) : "…"} – ${j.salaryMax != null ? formatMoney(j.salaryMax) : "…"}`}
                          <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><input type="checkbox" disabled={pending} checked={j.showSalary} onChange={(e) => run(() => setRecruitJobShowSalary(slug, j.id, e.target.checked))} className="h-3 w-3" />Show on careers page</label>
                        </>
                      ) : "—"}</td>
                      <td className="pr-3">{j.applicants}</td><td className="pr-3">{j.hired}/{j.openings}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <select disabled={pending} value={j.status} onChange={(e) => run(() => setRecruitJobStatus(slug, j.id, e.target.value))} className="rounded border bg-background px-1.5 py-1 text-[11px]">
                            {JOB_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </select>
                          <button aria-label="Delete job" disabled={pending} onClick={() => { if (confirm(`Delete "${j.title}" and its ${j.applicants} application(s)? Candidates stay in your talent pool.`)) run(() => deleteRecruitJob(slug, j.id)); }}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>Add the roles you are recruiting for, for yourself or on behalf of clients.</Empty>}
        </section>
      )}

      {tab === "candidates" && (
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Talent pool</h2>
            <button onClick={() => setModal("candidate")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add candidate</button>
          </div>
          {d.candidates.length ? (
            <div className="mt-4 space-y-2">
              {d.candidates.map((c) => {
                const apps = d.applications.filter((a) => a.candidateId === c.id);
                return (
                  <div key={c.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex flex-wrap items-start gap-2">
                      <div>
                        <p className="font-semibold">{c.firstName} {c.lastName}</p>
                        <p className="text-muted-foreground">{[c.currentRole, c.currentCompany].filter(Boolean).join(" at ") || "No current role"}{c.location ? ` · ${c.location}` : ""}</p>
                        <p className="text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        {c.skills && <p className="mt-1">{c.skills}</p>}
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        {c.cvUrl && <a href={cvHref(c)} target="_blank" rel="noopener noreferrer" className="rounded border px-2 py-1 text-[11px] font-semibold">CV</a>}
                        <button onClick={() => setModal({ kind: "apply", candidateId: c.id })} className="rounded border px-2 py-1 text-[11px] font-semibold">Add to job</button>
                        <button aria-label="Delete candidate" disabled={pending} onClick={() => { if (confirm(`Remove ${c.firstName} ${c.lastName} and all their applications?`)) run(() => deleteRecruitCandidate(slug, c.id)); }}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    </div>
                    {apps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {apps.map((a) => <button key={a.id} onClick={() => setModal({ kind: "app", id: a.id })} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]">{a.job.title}<Pill s={a.stage} /></button>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <Empty>Your talent pool will appear here once you add candidates.</Empty>}
        </section>
      )}

      {modal === "job" && (
        <Dialog title="New job opening" onClose={() => setModal(null)}>
          <form onSubmit={submitJob} className="mt-4 grid gap-3">
            <Field l="Job title *"><input name="title" required className={input} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field l="Client / employer"><input name="clientName" className={input} placeholder="Who is hiring?" /></Field>
              <Field l="Department"><input name="department" className={input} /></Field>
              <Field l="Location"><input name="location" className={input} /></Field>
              <Field l="Type"><select name="employmentType" className={input}>{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
              <Field l="Minimum salary"><input name="salaryMin" type="number" min="0" step="0.01" className={input} /></Field>
              <Field l="Maximum salary"><input name="salaryMax" type="number" min="0" step="0.01" className={input} /></Field>
              <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" name="showSalary" className="h-3.5 w-3.5" />Show the salary range on the public careers page</label>
              <Field l="Openings"><input name="openings" type="number" min="1" defaultValue={1} className={input} /></Field>
              <Field l="Closing date"><input name="closesAt" type="date" className={input} /></Field>
            </div>
            <Field l="Status"><select name="status" defaultValue="OPEN" className={input}>{JOB_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
            <Field l="Description"><textarea name="description" rows={3} className={input} /></Field>
            <Field l="Requirements"><textarea name="requirements" rows={3} className={input} /></Field>
            <button disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">Create job</button>
          </form>
        </Dialog>
      )}

      {modal === "candidate" && (
        <Dialog title="Add candidate" onClose={() => setModal(null)}>
          <form onSubmit={submitCandidate} className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field l="First name *"><input name="firstName" required className={input} /></Field>
              <Field l="Last name *"><input name="lastName" required className={input} /></Field>
              <Field l="Email"><input name="email" type="email" className={input} /></Field>
              <Field l="Phone"><input name="phone" className={input} /></Field>
              <Field l="Current role"><input name="currentRole" className={input} /></Field>
              <Field l="Current company"><input name="currentCompany" className={input} /></Field>
              <Field l="Location"><input name="location" className={input} /></Field>
              <Field l="Source"><input name="source" className={input} placeholder="Referral, LinkedIn, walk-in…" /></Field>
            </div>
            <Field l="Skills"><input name="skills" className={input} placeholder="Comma separated" /></Field>
            <Field l={`CV file (${CV_TYPE_HINT})`}><input name="cvFile" type="file" accept={CV_ACCEPT} className={input} /></Field>
            <Field l="…or CV link"><input name="cvUrl" type="url" className={input} placeholder="https://…" /></Field>
            <Field l="Attach to job (optional)"><select name="jobId" className={input}><option value="">Talent pool only</option>{openJobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.clientName ? ` · ${j.clientName}` : ""}</option>)}</select></Field>
            <Field l="Notes"><textarea name="notes" rows={3} className={input} /></Field>
            <button disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">Add candidate</button>
          </form>
        </Dialog>
      )}

      {modal && typeof modal === "object" && modal.kind === "apply" && (
        <Dialog title="Add candidate to a job" onClose={() => setModal(null)}>
          <div className="mt-4 space-y-2">
            {openJobs.filter((j) => j.status === "OPEN").map((j) => (
              <button key={j.id} disabled={pending} onClick={() => run(() => applyCandidateToJob(slug, modal.candidateId, j.id), () => setModal(null))} className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-xs">
                <span className="font-semibold">{j.title}{j.clientName && <span className="block font-normal text-muted-foreground">{j.clientName}</span>}</span><Plus className="h-4 w-4" />
              </button>
            ))}
            {!openJobs.some((j) => j.status === "OPEN") && <Empty>There are no open jobs. Create one first.</Empty>}
          </div>
        </Dialog>
      )}

      {modalApp && (
        <ReviewDialog key={modalApp.id} app={modalApp} pending={pending} onClose={() => setModal(null)}
          onSave={(rating, notes) => run(() => updateApplicationReview(slug, modalApp.id, rating, notes), () => setModal(null))}
          onStage={(s) => changeStage(modalApp, s)} />
      )}

      {stageDraft && (
        <Dialog title={stageDraft.stage === "INTERVIEW" ? "Schedule interview" : stageDraft.stage === "OFFER" ? "Make an offer" : stageDraft.stage === "HIRED" ? "Mark as hired" : "Reject application"} onClose={() => setStageDraft(null)}>
          <form onSubmit={submitStageDraft} className="mt-4 grid gap-3">
            {stageDraft.stage === "INTERVIEW" && <Field l="Interview date and time"><input name="interviewAt" type="datetime-local" className={input} /></Field>}
            {stageDraft.stage === "OFFER" && <Field l="Offer amount (optional)"><input name="offerAmount" type="number" min="0" step="0.01" className={input} /></Field>}
            {stageDraft.stage === "HIRED" && (
              <>
                <Field l="Start date (optional, defaults to today)"><input name="startDate" type="date" className={input} /></Field>
                <p className="text-xs text-muted-foreground">If HR &amp; Payroll is installed, an employee record is created automatically — you'll set their pay there.</p>
              </>
            )}
            {stageDraft.stage === "REJECTED" && <Field l="Reason (optional)"><textarea name="rejectionReason" rows={3} className={input} /></Field>}
            <button disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">Confirm</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function ReviewDialog({ app, pending, onClose, onSave, onStage }: {
  app: App; pending: boolean; onClose: () => void; onSave: (rating: number | null, notes: string) => void; onStage: (s: string) => void;
}) {
  const [rating, setRating] = useState<number | null>(app.rating);
  const [notes, setNotes] = useState(app.notes ?? "");
  return (
    <Dialog title={`${app.candidate.firstName} ${app.candidate.lastName}`} onClose={onClose}>
      <div className="mt-3 space-y-3 text-xs">
        <p className="text-muted-foreground">{app.job.title}{app.job.clientName ? ` · ${app.job.clientName}` : ""}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Pill s={app.stage} />
          <select disabled={pending} value={app.stage} onChange={(e) => onStage(e.target.value)} className="rounded border bg-background px-2 py-1">
            {RECRUIT_STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        {app.interviewAt && <p>Interview: <strong>{when(app.interviewAt)}</strong></p>}
        {app.offerAmount != null && <p>Offer: <strong>{formatMoney(app.offerAmount)}</strong></p>}
        {app.rejectionReason && <p>Rejection reason: {app.rejectionReason}</p>}
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={`text-lg ${rating && n <= rating ? "text-amber-500" : "text-muted-foreground/40"}`}>★</button>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Interview feedback, salary expectations, concerns…" className={`${input} w-full`} />
        <button disabled={pending} onClick={() => onSave(rating, notes)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">Save review</button>
      </div>
    </Dialog>
  );
}
