"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Plus, Users, Wallet, X } from "lucide-react";
import {
  createHrEmployee, createHrPayrollRun, recordHrAttendance, requestHrLeave,
  decideHrLeave, updateHrPayrollStatus, getHrDashboard,
} from "@/lib/actions/hr-payroll";
import { formatMoney } from "@/lib/utils/format-money";

type Data = Exclude<Awaited<ReturnType<typeof getHrDashboard>>, { error: string }>;
type Tab = "overview" | "employees" | "attendance" | "leave" | "payroll";
type Modal = null | "employee" | "payroll" | "leave";

const fmt = (n: number) => formatMoney(n);
const day = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const input = "rounded-lg border bg-background px-3 py-2 text-sm";
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600", ON_LEAVE: "bg-amber-500/10 text-amber-600",
  SUSPENDED: "bg-red-500/10 text-red-600", PENDING: "bg-amber-500/10 text-amber-600",
  APPROVED: "bg-emerald-500/10 text-emerald-600", REJECTED: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-muted text-muted-foreground", DRAFT: "bg-muted text-muted-foreground",
  PAID: "bg-emerald-500/10 text-emerald-600", VOID: "bg-red-500/10 text-red-600",
};
const Pill = ({ s }: { s: string }) => (
  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_TONE[s] ?? "bg-muted"}`}>{s.replace("_", " ")}</span>
);

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border bg-background p-5 shadow-xl ${wide ? "max-w-lg" : "max-w-md"}`}>
        <div className="flex items-center justify-between"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">{children}</div>
);

export function HrPayrollWorkspace({ slug, data }: { slug: string; data: Data }) {
  const [d, setD] = useState<Data>(data);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  // Reloads through the same server action that built the page (there is no separate API route).
  const refresh = async () => {
    const r = await getHrDashboard(slug);
    if ("error" in r) setMsg(r.error ?? "Could not refresh");
    else setD(r);
  };
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.success) { setMsg(r.error || "Something went wrong"); return; }
      setMsg(""); onOk?.(); await refresh();
    });

  const attendanceByEmployee = new Map(d.attendance.map((a) => [a.employee.id, a.status]));
  const roster = d.employees.filter((e) => e.status === "ACTIVE" || e.status === "ON_LEAVE");

  const submitEmployee = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget;
    run(() => createHrEmployee(slug, new FormData(form)), () => { setModal(null); form.reset(); });
  };
  const submitPayroll = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    run(() => createHrPayrollRun(slug, String(f.get("start")), String(f.get("end")), { applyStatutory: f.get("statutory") === "on", applyNhf: f.get("nhf") === "on" }), () => setModal(null));
  };
  const submitLeave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    run(() => requestHrLeave(slug, String(f.get("employeeId")), String(f.get("leaveType")), String(f.get("start")), String(f.get("end")), String(f.get("reason") || "")), () => setModal(null));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest People Operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">HR & Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage employees, attendance, leave and payroll from one operational workspace.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal("employee")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />Employee</button>
          <button onClick={() => setModal("payroll")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Wallet className="h-3.5 w-3.5" />Run payroll</button>
        </div>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-2.5 text-xs text-[var(--bn-admin-danger)]">
          <span>{msg}</span><button onClick={() => setMsg("")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Employees" value={d.activeCount} sub="Active workforce" />
        <Metric icon={CheckCircle2} label="Present today" value={d.present} sub="Attendance recorded" />
        <Metric icon={CalendarDays} label="Leave requests" value={d.pendingLeave} sub="Awaiting approval" />
        <Metric icon={Wallet} label="Latest net payroll" value={d.latestRun ? fmt(d.latestRun.totalNet) : "—"} sub={d.latestRun ? d.latestRun.status : "No payroll run"} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {(["overview", "employees", "attendance", "leave", "payroll"] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${tab === x ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{x[0].toUpperCase() + x.slice(1)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-bold">Today's attendance</h2>
            <div className="mt-3 space-y-2">
              {d.attendance.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-xs"><span className="font-semibold">{a.employee.firstName} {a.employee.lastName}</span><span className="ml-auto"><Pill s={a.status} /></span></div>
              ))}
              {!d.attendance.length && <p className="text-xs text-muted-foreground">No attendance has been recorded today.</p>}
            </div>
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-bold">Latest payroll</h2>
            {d.latestRun ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-muted-foreground">Gross</span><p className="mt-1 font-bold">{fmt(d.latestRun.totalGross)}</p></div>
                <div><span className="text-muted-foreground">Deductions</span><p className="mt-1 font-bold">{fmt(d.latestRun.totalDeductions)}</p></div>
                <div><span className="text-muted-foreground">Net</span><p className="mt-1 font-bold">{fmt(d.latestRun.totalNet)}</p></div>
              </div>
            ) : <p className="mt-3 text-xs text-muted-foreground">No payroll run yet.</p>}
          </section>
        </div>
      )}

      {tab === "employees" && (
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Employee management</h2></div>
              <p className="mt-1 text-xs text-muted-foreground">Employee records are the HR source of truth; compensation and employment status stay here.</p>
            </div>
            <button onClick={() => setModal("employee")} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add employee</button>
          </div>
          {d.employees.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-muted-foreground"><tr><th className="py-2 pr-3 font-semibold">Employee</th><th className="pr-3 font-semibold">No.</th><th className="pr-3 font-semibold">Position</th><th className="pr-3 font-semibold">Department</th><th className="pr-3 text-right font-semibold">Monthly gross</th><th className="font-semibold">Status</th></tr></thead>
                <tbody>
                  {d.employees.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="py-2.5 pr-3 font-semibold">{e.firstName} {e.lastName}{e.email && <span className="block font-normal text-muted-foreground">{e.email}</span>}</td>
                      <td className="pr-3">{e.employeeNo}</td><td className="pr-3">{e.position || "—"}</td><td className="pr-3">{e.department || "—"}</td>
                      <td className="pr-3 text-right">{fmt(e.basicSalary + e.housingAllowance + e.transportAllowance + e.otherAllowance)}</td>
                      <td><Pill s={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>Your employee directory will appear here after employees are added.</Empty>}
        </section>
      )}

      {tab === "attendance" && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-bold">Attendance control</h2>
          <p className="mt-1 text-xs text-muted-foreground">Mark today's attendance for everyone on the roster.</p>
          <div className="mt-3 space-y-2">
            {roster.map((e) => {
              const current = attendanceByEmployee.get(e.id);
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <span className="font-semibold">{e.firstName} {e.lastName}</span>
                  <span className="ml-auto text-muted-foreground">{current ? current.replace("_", " ") : "Not marked"}</span>
                  {(["PRESENT", "LATE", "ABSENT", "HALF_DAY"] as const).map((s) => (
                    <button key={s} disabled={pending} onClick={() => run(() => recordHrAttendance(slug, e.id, s))} className={`rounded border px-2 py-1 text-[10px] font-semibold ${current === s ? "border-primary bg-primary/10 text-primary" : ""}`}>{s.replace("_", " ")}</button>
                  ))}
                </div>
              );
            })}
            {!roster.length && <Empty>Add employees to start recording attendance.</Empty>}
          </div>
        </section>
      )}

      {tab === "leave" && (
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold">Leave management</h2><p className="mt-1 text-xs text-muted-foreground">Review requests, prevent overlapping leave and approve or reject time away.</p></div>
            <button onClick={() => setModal("leave")} disabled={!roster.length} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Request leave</button>
          </div>
          <div className="mt-3 space-y-2">
            {d.leaveRequests.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-xs">
                <div><span className="font-semibold">{l.employee.firstName} {l.employee.lastName}</span><span className="block text-muted-foreground">{l.leaveType} · {day(l.startDate)} to {day(l.endDate)}{l.reason ? ` · ${l.reason}` : ""}</span></div>
                <span className="ml-auto"><Pill s={l.status} /></span>
                {l.status === "PENDING" && (<>
                  <button disabled={pending} onClick={() => run(() => decideHrLeave(slug, l.id, "APPROVED"))} className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Approve</button>
                  <button disabled={pending} onClick={() => run(() => decideHrLeave(slug, l.id, "REJECTED"))} className="rounded border px-2 py-1 text-[10px] font-bold">Reject</button>
                </>)}
              </div>
            ))}
            {!d.leaveRequests.length && <Empty>Leave requests will appear here as employees submit them.</Empty>}
          </div>
        </section>
      )}

      {tab === "payroll" && (
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold">Payroll runs</h2><p className="mt-1 text-xs text-muted-foreground">Monthly runs with Nigerian pension and PAYE (Nigeria Tax Act 2025) calculated per employee.</p></div>
            <button onClick={() => setModal("payroll")} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Create payroll run</button>
          </div>
          <div className="mt-3 space-y-2">
            {d.payrollRuns.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2.5 text-xs">
                <div><span className="font-semibold">{day(r.periodStart)} to {day(r.periodEnd)}</span><span className="block text-muted-foreground">Gross {fmt(r.totalGross)} · Deductions {fmt(r.totalDeductions)} · Net {fmt(r.totalNet)}</span></div>
                <span className="ml-auto"><Pill s={r.status} /></span>
                {r.status === "DRAFT" && <button disabled={pending} onClick={() => run(() => updateHrPayrollStatus(slug, r.id, "APPROVED"))} className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Approve</button>}
                {r.status === "APPROVED" && <button disabled={pending} onClick={() => run(() => updateHrPayrollStatus(slug, r.id, "PAID"))} className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Mark paid</button>}
                {(r.status === "DRAFT" || r.status === "APPROVED") && <button disabled={pending} onClick={() => run(() => updateHrPayrollStatus(slug, r.id, "VOID"))} className="rounded border px-2 py-1 text-[10px] font-bold">Void</button>}
              </div>
            ))}
            {!d.payrollRuns.length && <Empty>No payroll runs yet.</Empty>}
          </div>
        </section>
      )}

      {modal === "employee" && (
        <Dialog title="Add employee" onClose={() => setModal(null)} wide>
          <form onSubmit={submitEmployee} className="mt-4 grid gap-2.5">
            <div className="grid gap-2 sm:grid-cols-2"><input required name="firstName" placeholder="First name" className={input} /><input required name="lastName" placeholder="Last name" className={input} /></div>
            <div className="grid gap-2 sm:grid-cols-2"><input required name="employeeNo" placeholder="Employee number" className={input} /><input name="position" placeholder="Position" className={input} /></div>
            <div className="grid gap-2 sm:grid-cols-2"><input name="department" placeholder="Department" className={input} /><input name="email" type="email" placeholder="Email" className={input} /></div>
            <input name="hireDate" type="date" className={input} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="basicSalary" type="number" min="0" placeholder="Basic salary (monthly)" className={input} />
              <input name="housingAllowance" type="number" min="0" placeholder="Housing allowance" className={input} />
              <input name="transportAllowance" type="number" min="0" placeholder="Transport allowance" className={input} />
              <input name="otherAllowance" type="number" min="0" placeholder="Other allowance" className={input} />
            </div>
            <input name="annualRent" type="number" min="0" placeholder="Annual rent paid (optional, for PAYE rent relief)" className={input} />
            <button disabled={pending} className="mt-1 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground">{pending ? "Saving…" : "Create employee"}</button>
          </form>
        </Dialog>
      )}

      {modal === "leave" && (
        <Dialog title="Request leave" onClose={() => setModal(null)}>
          <form onSubmit={submitLeave} className="mt-4 grid gap-3">
            <select required name="employeeId" className={input} defaultValue="">
              <option value="" disabled>Select employee</option>
              {roster.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNo})</option>)}
            </select>
            <select name="leaveType" className={input} defaultValue="Annual">{["Annual", "Sick", "Maternity", "Paternity", "Compassionate", "Unpaid"].map((t) => <option key={t}>{t}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><input required name="start" type="date" className={input} /><input required name="end" type="date" className={input} /></div>
            <input name="reason" placeholder="Reason (optional)" className={input} />
            <button disabled={pending} className="rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground">{pending ? "Saving…" : "Submit request"}</button>
          </form>
        </Dialog>
      )}

      {modal === "payroll" && (
        <Dialog title="Run payroll" onClose={() => setModal(null)}>
          <form onSubmit={submitPayroll} className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2"><input required name="start" type="date" className={input} /><input required name="end" type="date" className={input} /></div>
            <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="statutory" defaultChecked className="mt-0.5" /><span><b>Deduct pension and PAYE.</b> Employee pension is 8% of basic + housing + transport. PAYE uses the 2026 bands, with rent relief where annual rent is recorded.</span></label>
            <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="nhf" className="mt-0.5" /><span><b>Also deduct NHF (2.5% of basic).</b> Voluntary for private employers.</span></label>
            <p className="text-[11px] text-muted-foreground">Runs cover one month. Figures are estimates for payroll preparation; confirm with your accountant before remitting.</p>
            <button disabled={pending} className="rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground">{pending ? "Generating…" : "Generate payroll"}</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
