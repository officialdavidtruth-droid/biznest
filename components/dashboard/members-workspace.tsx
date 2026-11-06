"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMemberCharge, changeMembershipStatus, checkInMember, createMember, createPlan, enrollMember, recordGift, recordMemberPayment,
  regenerateMemberLink, setMemberActive, voidMemberCharge,
} from "@/lib/actions/members";
import { INTERVAL_LABEL, MEMBER_PAYMENT_METHODS, PLAN_INTERVALS, type MembersProfile } from "@/lib/members";
import type { MembersWorkspaceData } from "@/lib/members-data";

type Result = { success: boolean; error?: string };
type Row = MembersWorkspaceData["members"][number];

const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";
const STATE_TEXT: Record<string, string> = { ACTIVE: "Active", EXPIRING: "Ending soon", EXPIRED: "Expired", USED_UP: "Used up", PAUSED: "Paused", CANCELLED: "Cancelled", NOT_STARTED: "Not started" };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) => {
    setError(""); setNote("");
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };
  return { pending, error, note, run };
}

function Msg({ error, note }: { error: string; note: string }) {
  if (error) return <p role="alert" className="text-xs text-red-600">{error}</p>;
  if (note) return <p role="status" className="text-xs text-emerald-700">{note}</p>;
  return null;
}
function Tile({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${tone === "bad" ? "text-red-600" : ""}`}>{value}</p></div>;
}
const methodLabel = (m: string) => m[0] + m.slice(1).toLowerCase();

export function MembersWorkspace({ slug, data, profile, portalBase, giveUrl }: { slug: string; data: MembersWorkspaceData; profile: MembersProfile; portalBase: string; giveUrl: string }) {
  const tabs = ["members", ...(profile.giving ? ["giving"] : []), "plans"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("members");
  const active = data.members.filter((m) => m.active).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={profile.membersLabel} value={String(active)} />
        <Tile label="Owing" value={ngn(data.totals.owing)} />
        <Tile label="Overdue" value={ngn(data.totals.overdue)} tone={data.totals.overdue > 0 ? "bad" : undefined} />
        {profile.giving ? <Tile label="Given (all time)" value={ngn(data.giving.total)} /> : <Tile label="Recent check-ins" value={String(data.checkIns.length)} />}
      </div>
      <div className="flex gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border"}`}>
            {t === "members" ? profile.membersLabel : t === "giving" ? "Giving" : profile.plansLabel}
          </button>
        ))}
      </div>
      {tab === "members" && <MembersTab slug={slug} data={data} profile={profile} portalBase={portalBase} />}
      {tab === "giving" && <GivingTab slug={slug} data={data} giveUrl={giveUrl} />}
      {tab === "plans" && <PlansTab slug={slug} data={data} profile={profile} />}
    </div>
  );
}

function MembersTab({ slug, data, profile, portalBase }: { slug: string; data: MembersWorkspaceData; profile: MembersProfile; portalBase: string }) {
  const a = useAction();
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => createMember(slug, f), `${profile.memberLabel} added.`, () => setF({ name: "", email: "", phone: "" })); }}>
        <input className={input} placeholder="Full name" aria-label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} placeholder="Email (optional)" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={input} placeholder="Phone (optional)" aria-label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <button className={btn} disabled={a.pending}>Add {profile.memberLabel.toLowerCase()}</button>
        <div className="md:col-span-4"><Msg error={a.error} note={a.note} /></div>
      </form>
      {data.members.length === 0 && <p className="text-sm text-muted-foreground">No {profile.membersLabel.toLowerCase()} yet.</p>}
      <ul className="space-y-2">
        {data.members.map((m) => (
          <li key={m.id} className={`rounded-xl border bg-card ${m.active ? "" : "opacity-60"}`}>
            <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
              <span><b className="text-sm">{m.name}</b><span className="block text-xs text-muted-foreground">{[m.phone, m.email].filter(Boolean).join(" · ") || "No contact details"}</span></span>
              <span className="text-right text-xs">{m.overdue > 0 ? <b className="text-red-600">{ngn(m.overdue)} overdue</b> : m.owing > 0 ? <b>{ngn(m.owing)} owing</b> : <span className="text-muted-foreground">Up to date</span>}</span>
            </button>
            {open === m.id && <MemberDetail slug={slug} m={m} data={data} profile={profile} portalBase={portalBase} />}
          </li>
        ))}
      </ul>
      {data.checkIns.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-bold">{profile.checkInLabel}</p>
          <ul className="mt-2 space-y-1 text-xs">{data.checkIns.slice(0, 10).map((c) => <li key={c.id} className="flex justify-between"><span>{c.who}{c.usedSession ? " · used a session" : ""}</span><span className="text-muted-foreground">{day(c.at)}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

function MemberDetail({ slug, m, data, profile, portalBase }: { slug: string; m: Row; data: MembersWorkspaceData; profile: MembersProfile; portalBase: string }) {
  const a = useAction();
  const [planId, setPlanId] = useState("");
  const [pay, setPay] = useState<{ id: string; method: string; reference: string } | null>(null);
  const [extra, setExtra] = useState({ label: "", amount: "", dueDate: new Date().toISOString().slice(0, 10) });
  const [link, setLink] = useState(`${portalBase}${m.portalToken}`);
  const plans = data.plans.filter((p) => p.active && p.kind !== "FUND");
  return (
    <div className="space-y-4 border-t p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input readOnly className={`${input} max-w-sm`} value={link} aria-label="Member link" onFocus={(e) => e.currentTarget.select()} />
        <button className={ghost} disabled={a.pending} onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
        <button className={ghost} disabled={a.pending} onClick={() => { if (confirm("The old link will stop working. Continue?")) a.run(async () => { const r = await regenerateMemberLink(slug, m.id); if (r.success) setLink(`${portalBase}${r.data.portalToken}`); return r; }, "New link created."); }}>New link</button>
        <button className={ghost} disabled={a.pending} onClick={() => a.run(() => setMemberActive(slug, m.id, !m.active))}>{m.active ? "Deactivate" : "Reactivate"}</button>
      </div>

      {m.memberships.length > 0 && (
        <div>
          <p className="text-xs font-bold">Plans</p>
          <ul className="mt-1 space-y-2">
            {m.memberships.map((ms) => (
              <li key={ms.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{ms.planName} <span className="text-xs text-muted-foreground">· {STATE_TEXT[ms.state] ?? ms.state}{ms.sessionsLeft !== null ? ` · ${ms.sessionsLeft} left` : ""}{ms.renewsAt ? ` · renews ${day(ms.renewsAt)}` : ""}{ms.endsAt ? ` · ends ${day(ms.endsAt)}` : ""}</span></span>
                <span className="flex gap-2">
                  <button className={btn} disabled={a.pending} onClick={() => a.run(() => checkInMember(slug, ms.id, { force: m.overdue > 0 && confirm("Dues are overdue. Check in anyway?") }), "Checked in.")}>Check in</button>
                  {ms.status === "ACTIVE" && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => changeMembershipStatus(slug, ms.id, "PAUSED"))}>Pause</button>}
                  {ms.status === "PAUSED" && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => changeMembershipStatus(slug, ms.id, "ACTIVE"))}>Resume</button>}
                  {ms.status !== "CANCELLED" && <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this plan?") && a.run(() => changeMembershipStatus(slug, ms.id, "CANCELLED"))}>Cancel</button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plans.length > 0 && (
        <div className="flex gap-2">
          <select className={input} value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan">
            <option value="">Put on a plan or package…</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {ngn(p.price)}</option>)}
          </select>
          <button className={btn} disabled={a.pending || !planId} onClick={() => a.run(() => enrollMember(slug, m.id, planId), "Added and billed.", () => setPlanId(""))}>Add</button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold">Charges</p>
        {m.charges.length === 0 && <p className="text-xs text-muted-foreground">Nothing billed yet.</p>}
        <ul className="mt-1 space-y-2">
          {m.charges.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <span>{c.label}<span className="block text-xs text-muted-foreground">{c.status === "PAID" ? `Paid ${day(c.paidAt)}${c.receiptNo ? ` · ${c.receiptNo}` : ""}${c.method ? ` · ${methodLabel(c.method)}` : ""}` : `Due ${day(c.dueDate)}${c.state === "OVERDUE" ? " · overdue" : ""}`}</span></span>
                <b>{ngn(c.amount)}</b>
              </div>
              {c.status === "DUE" && (pay && pay.id === c.id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select className={`${input} w-32`} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} aria-label="Payment method">{MEMBER_PAYMENT_METHODS.map((x) => <option key={x} value={x}>{methodLabel(x)}</option>)}</select>
                  <input className={`${input} w-40`} placeholder="Reference (optional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
                  <button className={btn} disabled={a.pending} onClick={() => a.run(() => recordMemberPayment(slug, c.id, { method: pay.method, reference: pay.reference }), "Payment recorded.", () => setPay(null))}>Save</button>
                  <button className={ghost} onClick={() => setPay(null)}>Close</button>
                </div>
              ) : (
                <div className="mt-1 flex gap-2">
                  <button className={ghost} onClick={() => setPay({ id: c.id, method: "CASH", reference: "" })}>Record payment</button>
                  <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this charge?") && a.run(() => voidMemberCharge(slug, c.id))}>Cancel charge</button>
                </div>
              ))}
            </li>
          ))}
        </ul>
        <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => addMemberCharge(slug, m.id, { label: extra.label, amount: Number(extra.amount), dueDate: extra.dueDate }), "Charge added.", () => setExtra({ ...extra, label: "", amount: "" })); }}>
          <input className={input} placeholder="Extra charge, e.g. Joining fee" aria-label="Charge name" value={extra.label} onChange={(e) => setExtra({ ...extra, label: e.target.value })} />
          <input className={input} type="number" min="0" placeholder="Amount" aria-label="Amount" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} />
          <input className={input} type="date" aria-label="Due date" value={extra.dueDate} onChange={(e) => setExtra({ ...extra, dueDate: e.target.value })} />
          <button className={ghost} disabled={a.pending}>Add charge</button>
        </form>
      </div>
      <Msg error={a.error} note={a.note} />
      <span className="sr-only">{profile.memberLabel}</span>
    </div>
  );
}

function GivingTab({ slug, data, giveUrl }: { slug: string; data: MembersWorkspaceData; giveUrl: string }) {
  const a = useAction();
  const funds = ["General", ...data.plans.filter((p) => p.kind === "FUND" && p.active).map((p) => p.name)];
  const [f, setF] = useState({ fund: "General", amount: "", method: "CASH", memberId: "", donorName: "" });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="font-bold">Online giving page</p>
        <p className="mt-1 text-xs text-muted-foreground">Share this link or put it on your website. Gifts are paid by card or transfer and arrive with a receipt.</p>
        <input readOnly className={`${input} mt-2`} value={giveUrl} aria-label="Giving link" onFocus={(e) => e.currentTarget.select()} />
      </div>
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); a.run(() => recordGift(slug, { fund: f.fund, amount: Number(f.amount), method: f.method, memberId: f.memberId || undefined, donorName: f.donorName || undefined }), "Gift recorded.", () => setF({ ...f, amount: "", donorName: "" })); }}>
        <select className={input} value={f.fund} onChange={(e) => setF({ ...f, fund: e.target.value })} aria-label="Fund">{funds.map((x) => <option key={x}>{x}</option>)}</select>
        <input className={input} type="number" min="0" placeholder="Amount" aria-label="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={input} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} aria-label="How it was given">{MEMBER_PAYMENT_METHODS.map((x) => <option key={x} value={x}>{methodLabel(x)}</option>)}</select>
        <select className={input} value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} aria-label="Member"><option value="">Not a listed member</option>{data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input className={input} placeholder="Name (if not listed)" aria-label="Giver name" value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} />
        <button className={btn} disabled={a.pending}>Record gift</button>
        <div className="md:col-span-6"><Msg error={a.error} note={a.note} /></div>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-bold">By fund</p>
          {data.giving.byFund.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No gifts yet.</p>}
          <ul className="mt-2 space-y-1 text-sm">{data.giving.byFund.map((x) => <li key={x.fund} className="flex justify-between"><span>{x.fund} <span className="text-xs text-muted-foreground">({x.count})</span></span><b>{ngn(x.total)}</b></li>)}</ul>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-bold">By month</p>
          <ul className="mt-2 space-y-1 text-sm">{data.giving.byMonth.slice(0, 12).map((x) => <li key={x.month} className="flex justify-between"><span>{x.month}</span><b>{ngn(x.total)}</b></li>)}</ul>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-bold">Recent gifts</p>
        <ul className="mt-2 space-y-1 text-sm">{data.giving.recent.map((g) => <li key={g.id} className="flex justify-between gap-3"><span>{g.who} · {g.fund}<span className="block text-xs text-muted-foreground">{day(g.paidAt)}{g.receiptNo ? ` · ${g.receiptNo}` : ""}</span></span><b>{ngn(g.amount)}</b></li>)}</ul>
      </div>
    </div>
  );
}

function PlansTab({ slug, data, profile }: { slug: string; data: MembersWorkspaceData; profile: MembersProfile }) {
  const a = useAction();
  const kinds = [...(profile.giving ? [["FUND", "Giving fund"]] : []), ...(profile.memberships ? [["MEMBERSHIP", "Membership (recurring)"]] : []), ...(profile.packages ? [["PACKAGE", "Package of sessions"]] : [])];
  const [f, setF] = useState({ name: "", kind: kinds[0]?.[0] ?? "MEMBERSHIP", price: "", interval: "MONTHLY", sessions: "", validityDays: "" });
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => createPlan(slug, { name: f.name, kind: f.kind, price: Number(f.price || 0), interval: f.interval, sessions: f.sessions ? Number(f.sessions) : null, validityDays: f.validityDays ? Number(f.validityDays) : null }), "Saved.", () => setF({ ...f, name: "", price: "", sessions: "", validityDays: "" })); }}>
        <input className={input} placeholder={f.kind === "FUND" ? "e.g. Tithe, Building fund" : "e.g. Monthly gym, 5 braiding sessions"} aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Type">{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {f.kind !== "FUND" && <input className={input} type="number" min="0" placeholder="Price" aria-label="Price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />}
        {f.kind === "MEMBERSHIP" && <select className={input} value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })} aria-label="Billing">{PLAN_INTERVALS.filter((i) => i !== "ONCE").map((i) => <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>)}</select>}
        {f.kind === "PACKAGE" && <input className={input} type="number" min="1" placeholder="Sessions" aria-label="Sessions" value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} />}
        {f.kind === "PACKAGE" && <input className={input} type="number" min="1" placeholder="Valid for (days, optional)" aria-label="Validity in days" value={f.validityDays} onChange={(e) => setF({ ...f, validityDays: e.target.value })} />}
        <button className={btn} disabled={a.pending}>Add</button>
        <div className="md:col-span-4"><Msg error={a.error} note={a.note} /></div>
      </form>
      <ul className="space-y-2">
        {data.plans.map((p) => (
          <li key={p.id} className={`flex items-center justify-between rounded-xl border bg-card p-4 text-sm ${p.active ? "" : "opacity-60"}`}>
            <span><b>{p.name}</b><span className="block text-xs text-muted-foreground">{p.kind === "FUND" ? "Giving fund" : p.kind === "PACKAGE" ? `${p.sessions} sessions${p.validityDays ? `, valid ${p.validityDays} days` : ""}` : INTERVAL_LABEL[p.interval as keyof typeof INTERVAL_LABEL] ?? p.interval}</span></span>
            {p.kind !== "FUND" && <b>{ngn(p.price)}</b>}
          </li>
        ))}
        {data.plans.length === 0 && <p className="text-sm text-muted-foreground">Nothing set up yet.</p>}
      </ul>
    </div>
  );
}
