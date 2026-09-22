"use client";

import { useEffect, useState, useTransition, type ComponentType } from "react";
import { ArrowRight, CheckCircle2, Loader2, Mail, Pencil, ShoppingCart, UserPlus, Workflow, X, Zap } from "lucide-react";
import { activatePresetAutomation, listAutomationsByTrigger, toggleAutomation, updatePresetAutomation } from "@/lib/actions/business-platform";

type EmailAction = { type: "EMAIL"; template: string; subject?: string; headline?: string; emailBody?: string; ctaLabel?: string; ctaUrl?: string };
type FollowUpAction = { type: "CRM_FOLLOW_UP"; days?: number };
type OtherAction = { type: string; [k: string]: unknown };
type AnyAction = EmailAction | FollowUpAction | OtherAction;

type Preset = {
  trigger: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  kind: "email" | "followup";
  actions: AnyAction[];
};

const PRESETS: Preset[] = [
  { trigger: "NEWSLETTER_SUBSCRIBER_CREATED", name: "New subscriber welcome", description: "Send a branded welcome email when a new newsletter subscriber joins.", icon: UserPlus, kind: "email", actions: [{ type: "EMAIL", template: "welcome" }] },
  { trigger: "CRM_LEAD_CREATED", name: "Lead follow-up", description: "Notify you and schedule a follow-up date when a new CRM lead comes in.", icon: Zap, kind: "followup", actions: [{ type: "NOTIFY_STAFF", message: "New lead needs follow-up." }, { type: "CRM_FOLLOW_UP", days: 1 }] },
  { trigger: "CHECKOUT_ABANDONED", name: "Abandoned checkout", description: "Email a reminder, in your branding, when a checkout is abandoned.", icon: ShoppingCart, kind: "email", actions: [{ type: "EMAIL", template: "winback" }] },
  { trigger: "ORDER_COMPLETED", name: "Post-purchase thank you", description: "Send a branded thank-you email after a successful order.", icon: Mail, kind: "email", actions: [{ type: "EMAIL", template: "thankyou" }] },
];

type Row = { id: string; trigger: string; status: "ACTIVE" | "PAUSED"; actions: AnyAction[] };

export function MarketingAutomationPanel({ slug, activeCount }: { slug: string; activeCount: number }) {
  const [rows, setRows] = useState<Record<string, Row | null> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listAutomationsByTrigger(slug, PRESETS.map((p) => p.trigger)).then((r) => {
      if (cancelled || !("data" in r) || !r.data) return;
      const map: Record<string, Row | null> = {};
      for (const p of PRESETS) map[p.trigger] = null;
      for (const a of r.data) map[a.trigger] = { id: a.id, trigger: a.trigger, status: a.status as "ACTIVE" | "PAUSED", actions: (Array.isArray(a.actions) ? a.actions : []) as AnyAction[] };
      setRows(map);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const liveCount = rows ? Object.values(rows).filter((r) => r?.status === "ACTIVE").length : activeCount;

  function activate(p: Preset) {
    setBusy(p.trigger);
    start(async () => {
      const r = await activatePresetAutomation(slug, { name: p.name, description: p.description, trigger: p.trigger, actions: p.actions });
      setBusy(null);
      if ("error" in r && r.error) return alert(r.error);
      if ("data" in r && r.data) setRows((cur) => ({ ...(cur ?? {}), [p.trigger]: { id: r.data.id, trigger: p.trigger, status: r.data.status as "ACTIVE" | "PAUSED", actions: (Array.isArray(r.data.actions) ? r.data.actions : []) as AnyAction[] } }));
    });
  }

  function toggle(row: Row, next: boolean) {
    setBusy(row.trigger);
    setRows((cur) => ({ ...(cur ?? {}), [row.trigger]: { ...row, status: next ? "ACTIVE" : "PAUSED" } }));
    start(async () => {
      const r = await toggleAutomation(slug, row.id, next);
      setBusy(null);
      if ("error" in r && r.error) setRows((cur) => ({ ...(cur ?? {}), [row.trigger]: row })); // revert
    });
  }

  function saveEdit(row: Row | null, preset: Preset, actions: AnyAction[]) {
    start(async () => {
      if (row) {
        const r = await updatePresetAutomation(slug, row.id, actions);
        if ("error" in r && r.error) return alert(r.error);
        setRows((cur) => ({ ...(cur ?? {}), [preset.trigger]: { ...row, actions } }));
      } else {
        const r = await activatePresetAutomation(slug, { name: preset.name, description: preset.description, trigger: preset.trigger, actions });
        if ("error" in r && r.error) return alert(r.error);
        if ("data" in r && r.data) setRows((cur) => ({ ...(cur ?? {}), [preset.trigger]: { id: r.data.id, trigger: preset.trigger, status: r.data.status as "ACTIVE" | "PAUSED", actions } }));
      }
      setEditing(null);
    });
  }

  return (
    <section className="rounded-3xl border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Workflow className="h-4 w-4" />Marketing automation</div>
          <h2 className="mt-1 text-lg font-bold">Build the follow-up engine</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Turn one-time campaigns into automated customer journeys that run in the background.</p>
        </div>
        <div className="rounded-xl bg-[hsl(var(--primary)/0.1)] px-3 py-2 text-xs font-semibold text-primary">{liveCount} active workflow{liveCount === 1 ? "" : "s"}</div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const row = rows ? rows[p.trigger] : undefined;
          const loading = rows === null;
          const on = row?.status === "ACTIVE";
          return (
            <div key={p.trigger} className="flex flex-col rounded-2xl border p-4 transition hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-4 w-4" /></span>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : row ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? "Turn off" : "Turn on"} ${p.name}`}
                    disabled={busy === p.trigger}
                    onClick={() => toggle(row, !on)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${on ? "translate-x-[18px]" : "translate-x-1"}`} />
                  </button>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <h3 className="mt-3 text-sm font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-10 flex-1 text-xs leading-5 text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                {!loading && row ? (
                  <span className={`text-[11px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}>{on ? "On" : "Off"}</span>
                ) : (
                  <button disabled={loading || busy === p.trigger} onClick={() => activate(p)} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary disabled:opacity-50">Activate workflow <ArrowRight className="h-3.5 w-3.5" /></button>
                )}
                {!loading && (
                  <button type="button" onClick={() => setEditing(p)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary">
                    <Pencil className="h-3 w-3" />{p.kind === "email" ? "Edit email" : "Edit"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && rows && (
        <EditModal
          preset={editing}
          row={rows[editing.trigger] ?? null}
          onClose={() => setEditing(null)}
          onSave={(actions) => saveEdit(rows[editing.trigger] ?? null, editing, actions)}
        />
      )}
    </section>
  );
}

function EditModal({ preset, row, onClose, onSave }: { preset: Preset; row: Row | null; onClose: () => void; onSave: (actions: AnyAction[]) => void }) {
  const current = row?.actions ?? preset.actions;
  const emailAction = current.find((a): a is EmailAction => a.type === "EMAIL");
  const followUpAction = current.find((a): a is FollowUpAction => a.type === "CRM_FOLLOW_UP");

  const [subject, setSubject] = useState(emailAction?.subject ?? "");
  const [headline, setHeadline] = useState(emailAction?.headline ?? "");
  const [body, setBody] = useState(emailAction?.emailBody ?? "");
  const [ctaLabel, setCtaLabel] = useState(emailAction?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(emailAction?.ctaUrl ?? "");
  const [days, setDays] = useState(followUpAction?.days ?? 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  function save() {
    const next = current.map((a) => {
      if (preset.kind === "email" && a.type === "EMAIL") {
        return { ...a, subject: subject.trim() || undefined, headline: headline.trim() || undefined, emailBody: body.trim() || undefined, ctaLabel: ctaLabel.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined };
      }
      if (preset.kind === "followup" && a.type === "CRM_FOLLOW_UP") {
        return { ...a, days: Math.min(30, Math.max(1, Math.round(days) || 1)) };
      }
      return a;
    });
    onSave(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Edit ${preset.name}`} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border bg-background p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-bold">{preset.name}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <p className="mb-5 text-xs text-muted-foreground">{preset.kind === "email" ? "Leave a field blank to use the design's own wording." : "How many days after a lead comes in should the follow-up be due?"}</p>

        {preset.kind === "email" ? (
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-medium">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Default subject" maxLength={180} className={field} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Headline<input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Default headline" maxLength={150} className={field} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Message<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Default message" maxLength={2000} className={field} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium">Button label<input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Default label" maxLength={40} className={field} /></label>
              <label className="grid gap-1.5 text-xs font-medium">Button link<input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="Your store" maxLength={2000} className={field} /></label>
            </div>
          </div>
        ) : (
          <label className="grid gap-1.5 text-xs font-medium">Days until follow-up<input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${field} max-w-[8rem]`} /></label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save</button>
        </div>
      </div>
    </div>
  );
}
