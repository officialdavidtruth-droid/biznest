"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Mail, Send, Users } from "lucide-react";
import { sendMarketingCampaign } from "@/lib/actions/marketing";
import { EmailDesigner, type EmailDesign } from "@/components/marketing/email-designer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Check = { ok: boolean; blocking?: boolean; label: string; detail?: string };

/** Guided email builder for the dashboard: Design → Write → Products → Style → Send. */
export function MarketingEmailComposer({
  slug,
  design,
  activeSubscribers,
  onSent,
}: {
  slug: string;
  design: EmailDesign;
  activeSubscribers: number;
  onSent?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [manualEmailsText, setManualEmailsText] = useState("");

  // Accepts emails separated by spaces, commas, semicolons, or newlines — however a
  // list is pasted in. The server de-dupes against subscribers and re-validates.
  const manualEmails = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of manualEmailsText.split(/[\s,;]+/)) {
      const email = raw.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(email);
    }
    return list;
  }, [manualEmailsText]);
  const manualInvalidCount = manualEmails.filter((e) => !EMAIL_RE.test(e)).length;
  const manualValidCount = manualEmails.length - manualInvalidCount;
  const totalRecipients = activeSubscribers + manualValidCount;

  const { content, template, subject } = design;
  const checks: Check[] = [
    { ok: !!subject.trim(), blocking: true, label: "Subject line", detail: subject.trim() || "Add a subject in the Write step" },
    { ok: !!content.headline.trim(), blocking: true, label: "Headline", detail: content.headline.trim() || "Add a headline in the Write step" },
    { ok: !!content.body.trim(), blocking: true, label: "Message", detail: content.body.trim() ? `${content.body.trim().length} characters` : "Write your message in the Write step" },
    { ok: !content.ctaLabel || !!content.ctaUrl, label: "Button", detail: content.ctaLabel ? `“${content.ctaLabel}”` : "No button (optional)" },
    { ok: design.sampleWarnings.length === 0, label: "Real details", detail: design.sampleWarnings.length ? `Still showing sample ${design.sampleWarnings.join(", ")}` : "No placeholder offers or dates" },
  ];
  const blocked = checks.some((c) => c.blocking && !c.ok);

  function submit() {
    setResult(null);
    if (design.sampleWarnings.length) {
      const ok = window.confirm(`This email still uses the design's sample ${design.sampleWarnings.join(", ")}. Go back and replace it, or send anyway?\n\nPress OK to send anyway.`);
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await sendMarketingCampaign(slug, design.input, manualEmails);
      if (r.success) {
        const invalidNote = r.data.invalid ? ` ${r.data.invalid} entered email${r.data.invalid === 1 ? " wasn't" : "s weren't"} valid and were skipped.` : "";
        setResult({ ok: true, text: `Sent to ${r.data.sent} recipient${r.data.sent === 1 ? "" : "s"}${r.data.failed ? `, ${r.data.failed} failed` : ""}.${invalidNote}` });
        onSent?.();
      } else setResult({ ok: false, text: r.error ?? "Could not send campaign." });
    });
  }

  const sendNode = (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-background p-5">
        <div className="mb-4"><h2 className="text-sm font-semibold">Review</h2><p className="mt-1 text-xs text-muted-foreground">A last look before it goes out.</p></div>
        <ul className="divide-y">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3 py-2.5">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${c.blocking ? "text-rose-600" : "text-amber-600"}`} />}
              <div className="min-w-0"><p className="text-sm font-medium">{c.label}</p><p className="truncate text-xs text-muted-foreground">{c.detail}</p></div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Who receives it</h2></div>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
          <div><p className="text-sm font-medium">Newsletter subscribers</p><p className="text-xs text-muted-foreground">Active and opted in. Unsubscribed people are always excluded.</p></div>
          <span className="text-xl font-bold tabular-nums">{activeSubscribers.toLocaleString()}</span>
        </div>
        <label className="grid gap-1.5">
          <span className="flex items-center gap-2 text-xs font-medium"><Mail className="h-3.5 w-3.5 text-primary" />Add more email addresses (optional)</span>
          <textarea value={manualEmailsText} onChange={(e) => setManualEmailsText(e.target.value)} rows={4} placeholder={"example@gmail.com example2@gmail.com\nor one per line, or comma-separated"} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <span className="text-[11px] text-muted-foreground">Paste from a spreadsheet or text file. Separate with spaces, commas, semicolons or new lines.</span>
        </label>
        {manualEmails.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {manualValidCount} valid email{manualValidCount === 1 ? "" : "s"} found
            {manualInvalidCount > 0 && <span className="text-destructive"> · {manualInvalidCount} invalid entr{manualInvalidCount === 1 ? "y" : "ies"} will be skipped</span>}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
        <div><p className="text-sm font-semibold">{totalRecipients.toLocaleString()} recipient{totalRecipients === 1 ? "" : "s"}</p><p className="mt-0.5 text-xs text-muted-foreground">{blocked ? "Complete the items marked in red above to send." : "Sending can’t be undone."}</p></div>
        <button type="button" disabled={isPending || totalRecipients === 0 || blocked} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{isPending ? "Sending…" : "Send campaign"}</button>
      </div>
      {result && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{result.text}
        </div>
      )}
    </div>
  );

  // BizNest no longer has a dark mode — the composer preview always renders light.
  return <EmailDesigner design={design} variant="admin" darkPreview={false} sendStep={{ label: "Send", node: sendNode }} />;
}
