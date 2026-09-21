"use client";

import { useMemo, useState, useTransition } from "react";
import { Mail, Send } from "lucide-react";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";
import { sendMarketingCampaign } from "@/lib/actions/marketing";
import { useTheme } from "@/components/theme/theme-provider";
import { EmailDesigner, useEmailDesign } from "@/components/marketing/email-designer";

export function MarketingEmailComposer({
  slug,
  brand,
  items,
  activeSubscribers,
}: {
  slug: string;
  brand: MarketingBrand;
  items: MarketingItem[];
  activeSubscribers: number;
}) {
  const design = useEmailDesign(brand, items);
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [manualEmailsText, setManualEmailsText] = useState("");

  // Accepts emails separated by spaces, commas, semicolons, or newlines —
  // however someone pastes a list in (from a spreadsheet, a text file, a
  // chat message, etc). Case-insensitive de-dupe against itself; the server
  // also de-dupes against existing subscribers and validates each address.
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
  const manualInvalidCount = useMemo(() => manualEmails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length, [manualEmails]);
  const manualValidCount = manualEmails.length - manualInvalidCount;
  const totalRecipients = activeSubscribers + manualValidCount;

  function submit() {
    setMessage(null);
    if (design.sampleWarnings.length) {
      const ok = window.confirm(`This email still uses the design's sample ${design.sampleWarnings.join(", ")}. Replace it with your real details first, or send anyway?\n\nPress OK to send anyway.`);
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await sendMarketingCampaign(slug, design.input, manualEmails);
      if (result.success) {
        const invalidNote = result.data.invalid ? ` · ${result.data.invalid} entered email${result.data.invalid === 1 ? " wasn't" : "s weren't"} valid and were skipped` : "";
        setMessage(`Campaign sent to ${result.data.sent} recipient${result.data.sent === 1 ? "" : "s"}${result.data.failed ? ` · ${result.data.failed} failed` : ""}${invalidNote}.`);
      } else setMessage(result.error ?? "Could not send campaign.");
    });
  }

  return (
    <EmailDesigner design={design} variant="admin" darkPreview={resolvedTheme === "dark"}>
      <div className="rounded-2xl border bg-background p-5">
        <div className="mb-3 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Add recipients manually</h2></div>
        <p className="mb-3 text-xs text-muted-foreground">Not everyone you want to reach has subscribed yet. Paste a list of emails below — separated by spaces, commas, semicolons or new lines (pasting straight from a spreadsheet or a text file works fine).</p>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Additional email addresses</span>
          <textarea
            value={manualEmailsText}
            onChange={(e) => setManualEmailsText(e.target.value)}
            rows={4}
            placeholder={"example@gmail.com example2@gmail.com\nor one per line, or comma-separated"}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {manualEmails.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {manualValidCount} valid email{manualValidCount === 1 ? "" : "s"} found
            {manualInvalidCount > 0 && <span className="text-destructive"> · {manualInvalidCount} invalid entr{manualInvalidCount === 1 ? "y" : "ies"} will be skipped</span>}
          </p>
        )}
      </div>

      {design.sampleWarnings.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <p className="font-semibold">This design still has sample {design.sampleWarnings.join(", ")}.</p>
          <p className="mt-1 text-muted-foreground">Edit {design.sampleWarnings.length === 1 ? "it" : "them"} above (or clear the field) so customers don&apos;t receive placeholder details.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
        <div><p className="text-sm font-semibold">Ready to send?</p><p className="mt-1 text-xs text-muted-foreground">Goes to active, opted-in newsletter subscribers plus any manually entered emails above.</p></div>
        <button type="button" disabled={isPending || totalRecipients === 0} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{isPending ? "Sending…" : `Send to ${totalRecipients} recipient${totalRecipients === 1 ? "" : "s"}`}</button>
      </div>
      {message && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{message}</div>}
    </EmailDesigner>
  );
}
