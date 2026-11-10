"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendCampaign, sendCampaignTest, sendNextCampaignBatch, saveEmailTemplate, resetEmailTemplate, deleteEmailTemplate } from "@/lib/actions/platform-email";

export type TemplateOption = {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: string;
  kind: "default" | "edited" | "custom";
};

type AudienceOption = { value: string; label: string; hint: string; count: number };

const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function CampaignComposer({ audiences, templates }: { audiences: AudienceOption[]; templates: TemplateOption[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState(audiences[0]?.value ?? "NO_BUSINESS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | "tpl" | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [pickerOpen, setPickerOpen] = useState(true);

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const shown = templates.filter((t) => category === "All" || t.category === category);
  const loaded = templates.find((t) => t.id === loadedId) ?? null;
  const blanks = /\[\[[^\]]*\]\]/.test(`${subject}\n${body}\n${ctaLabel}\n${ctaUrl}`);

  function use(t: TemplateOption) {
    setLoadedId(t.id);
    setSubject(t.subject);
    setBody(t.body);
    setCtaLabel(t.ctaLabel);
    setCtaUrl(t.ctaUrl);
    if (audiences.some((a) => a.value === t.audience)) setAudience(t.audience);
    setPickerOpen(false);
    toast.success(`Loaded "${t.name}". Edit anything you like before sending.`);
  }

  async function saveTemplate(asNew: boolean) {
    let name = loaded?.name ?? "";
    if (asNew || !loaded) {
      const n = window.prompt("Name this template", loaded ? `${loaded.name} (copy)` : "");
      if (!n) return;
      name = n;
    }
    setBusy("tpl");
    const r = await saveEmailTemplate({
      id: asNew ? undefined : loaded?.id,
      name,
      category: asNew || !loaded ? "My templates" : loaded.category,
      description: asNew || !loaded ? "" : loaded.description,
      subject,
      body,
      ctaLabel,
      ctaUrl,
      audience,
    } as Parameters<typeof saveEmailTemplate>[0]);
    setBusy(null);
    if (!r.success) return toast.error(r.error);
    setLoadedId(r.data.id);
    toast.success(asNew || !loaded ? "Saved as a new template." : "Template updated.");
    router.refresh();
  }

  async function resetTemplate() {
    if (!loaded || !window.confirm(`Put "${loaded.name}" back to the original wording?`)) return;
    setBusy("tpl");
    const r = await resetEmailTemplate(loaded.id);
    setBusy(null);
    if (!r.success) return toast.error(r.error);
    setLoadedId(null);
    toast.success("Restored to the original. Pick it again to load it.");
    router.refresh();
  }

  async function removeTemplate() {
    if (!loaded || !window.confirm(`Delete "${loaded.name}"? This can't be undone.`)) return;
    setBusy("tpl");
    const r = await deleteEmailTemplate(loaded.id);
    setBusy(null);
    if (!r.success) return toast.error(r.error);
    setLoadedId(null);
    toast.success("Template deleted.");
    router.refresh();
  }

  const selected = audiences.find((a) => a.value === audience);
  const input = { subject, body, ctaLabel, ctaUrl, audience };

  async function test() {
    setBusy("test");
    const r = await sendCampaignTest(input, testTo);
    setBusy(null);
    if (!r.success) return toast.error(r.error);
    toast.success(`Test sent to ${testTo.trim()}.`);
  }

  async function send() {
    const n = selected?.count ?? 0;
    if (n === 0) return toast.error("Nobody is in this audience right now.");
    if (!window.confirm(`Send "${subject.trim() || "this email"}" to ${n.toLocaleString()} ${n === 1 ? "person" : "people"}? This can't be undone.`)) return;
    setBusy("send");
    const r = await sendCampaign(input);
    setBusy(null);
    if (!r.success) return toast.error(r.error);
    if (r.data.failures > 0) {
      toast.error(`${r.data.failures} email${r.data.failures === 1 ? "" : "s"} failed${r.data.error ? `: ${r.data.error}` : ""}. ${r.data.sent} went out. Use "Send next batch" to retry.`);
    } else toast.success(
      r.data.remaining > 0
        ? `Sent ${r.data.sent}. ${r.data.remaining} more are queued and will go out with the next batch or tomorrow's daily run.`
        : `Sent to ${r.data.sent}.`
    );
    router.refresh();
    if (r.data.failures > 0) return; // keep the email on screen so nothing is lost
    setSubject("");
    setBody("");
    setCtaLabel("");
    setCtaUrl("");
    setLoadedId(null);
    setPickerOpen(true);
  }

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">New email</h2>
        <button type="button" onClick={() => setPickerOpen((o) => !o)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
          {pickerOpen ? "Hide templates" : `Pick a template (${templates.length})`}
        </button>
      </div>

      {pickerOpen && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${category === c ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => use(t)}
                className={`rounded-lg border bg-background p-3 text-left hover:border-primary ${loadedId === t.id ? "border-primary ring-1 ring-primary/40" : ""}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {t.kind !== "default" && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{t.kind === "edited" ? "Edited" : "Yours"}</span>}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.description || t.subject}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loaded && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Using: <strong className="text-foreground">{loaded.name}</strong></span>
          <button type="button" disabled={busy !== null} onClick={() => saveTemplate(false)} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50">Save changes to template</button>
          <button type="button" disabled={busy !== null} onClick={() => saveTemplate(true)} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50">Save as new</button>
          {loaded.kind === "edited" && <button type="button" disabled={busy !== null} onClick={resetTemplate} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50">Reset to original</button>}
          {loaded.kind === "custom" && <button type="button" disabled={busy !== null} onClick={removeTemplate} className="rounded-lg border px-3 py-1.5 font-semibold text-destructive disabled:opacity-50">Delete</button>}
        </div>
      )}
      {!loaded && (subject || body) && (
        <button type="button" disabled={busy !== null} onClick={() => saveTemplate(true)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Save this as a template</button>
      )}
      {blanks && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Fill in everything written in [[double brackets]]. You can&apos;t send or test this email until they&apos;re gone.
        </p>
      )}

      <label className="block text-xs text-muted-foreground">
        Send to
        <select className={`${field} mt-1`} value={audience} onChange={(e) => setAudience(e.target.value)}>
          {audiences.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} ({a.count.toLocaleString()})
            </option>
          ))}
        </select>
        <span className="mt-1 block">{selected?.hint}</span>
      </label>

      <label className="block text-xs text-muted-foreground">
        Subject
        <input className={`${field} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
      </label>

      <label className="block text-xs text-muted-foreground">
        Message
        <textarea className={`${field} mt-1 min-h-[160px]`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
        <span className="mt-1 block">Leave a blank line between paragraphs. Use {"{name}"} to insert the person's first name.</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          Button label (optional)
          <input className={`${field} mt-1`} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Button link
          <input className={`${field} mt-1`} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://… or /templates" />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
        <label className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
          Send a test to
          <input className={`${field} mt-1`} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
        </label>
        <button onClick={test} disabled={busy !== null || blanks} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy === "test" ? "Sending test…" : "Send test"}
        </button>
        <button onClick={send} disabled={busy !== null || blanks} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy === "send" ? "Sending…" : "Send to audience"}
        </button>
      </div>
    </div>
  );
}

export function ContinueSendingButton({ campaignId, remaining }: { campaignId: string; remaining: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await sendNextCampaignBatch(campaignId);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    if (r.data.failures > 0) toast.error(`${r.data.failures} failed${r.data.error ? `: ${r.data.error}` : ""}. ${r.data.sent} went out.`);
    else toast.success(r.data.remaining > 0 ? `Sent ${r.data.sent}. ${r.data.remaining} left.` : `Sent ${r.data.sent}. Done.`);
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy} className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
      {busy ? "Sending…" : `Send next batch (${remaining} left)`}
    </button>
  );
}
