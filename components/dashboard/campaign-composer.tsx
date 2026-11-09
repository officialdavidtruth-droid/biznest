"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendCampaign, sendCampaignTest, sendNextCampaignBatch } from "@/lib/actions/platform-email";

type AudienceOption = { value: string; label: string; hint: string; count: number };

const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function CampaignComposer({ audiences }: { audiences: AudienceOption[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState(audiences[0]?.value ?? "NO_BUSINESS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);

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
    toast.success(
      r.data.remaining > 0
        ? `Sent ${r.data.sent}. ${r.data.remaining} more are queued and will go out with the next batch or tomorrow's daily run.`
        : `Sent to ${r.data.sent}.`
    );
    setSubject("");
    setBody("");
    setCtaLabel("");
    setCtaUrl("");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <h2 className="text-sm font-semibold">New email</h2>

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
        <button onClick={test} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy === "test" ? "Sending test…" : "Send test"}
        </button>
        <button onClick={send} disabled={busy !== null} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
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
    toast.success(r.data.remaining > 0 ? `Sent ${r.data.sent}. ${r.data.remaining} left.` : `Sent ${r.data.sent}. Done.`);
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy} className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
      {busy ? "Sending…" : `Send next batch (${remaining} left)`}
    </button>
  );
}
