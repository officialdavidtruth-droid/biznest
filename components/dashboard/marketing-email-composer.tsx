"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Image as ImageIcon, Mail, Send, Sparkles } from "lucide-react";
import {
  MARKETING_TEMPLATES,
  defaultMarketingContent,
  renderMarketingEmail,
  type MarketingBrand,
  type MarketingItem,
  type MarketingTemplateId,
} from "@/lib/email/marketing-templates";
import { sendMarketingCampaign, type MarketingSendInput } from "@/lib/actions/marketing";
import { useTheme } from "@/components/theme/theme-provider";

/**
 * The actual email is always rendered light (email clients render it as
 * authored), so this only reshapes the *preview* iframe when the dashboard
 * itself is in dark mode — it never touches what gets sent. Uses the
 * standard invert+hue-rotate trick to flip the light email to dark while
 * re-inverting images/media so photos don't come out looking like negatives.
 */
function darkenEmailPreview(html: string): string {
  const darkModeStyle = `
    <style>
      html, body { filter: invert(1) hue-rotate(180deg); background: #fff !important; }
      img, svg, video, picture, [style*="background-image"] { filter: invert(1) hue-rotate(180deg); }
    </style>
  `;
  return html.includes("</head>") ? html.replace("</head>", `${darkModeStyle}</head>`) : `${darkModeStyle}${html}`;
}

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
  const [template, setTemplate] = useState<MarketingTemplateId>("announcement");
  const defaults = useMemo(() => defaultMarketingContent(template, brand, items), [template, brand, items]);
  const [subject, setSubject] = useState("A special update from our business");
  const [eyebrow, setEyebrow] = useState(defaults.eyebrow);
  const [headline, setHeadline] = useState(defaults.headline);
  const [body, setBody] = useState(defaults.body);
  const [ctaLabel, setCtaLabel] = useState(defaults.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(defaults.ctaUrl);
  const [imageUrl, setImageUrl] = useState(defaults.imageUrl ?? "");
  const [selectedItems, setSelectedItems] = useState<string[]>(items.slice(0, 4).map((_, i) => String(i)));
  const [previewText, setPreviewText] = useState(defaults.previewText ?? "A new update from our business.");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
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

  function changeTemplate(next: MarketingTemplateId) {
    setTemplate(next);
    const d = defaultMarketingContent(next, brand, items);
    setEyebrow(d.eyebrow); setHeadline(d.headline); setBody(d.body); setCtaLabel(d.ctaLabel); setCtaUrl(d.ctaUrl); setImageUrl(d.imageUrl ?? ""); setPreviewText(d.previewText ?? d.headline);
    setSelectedItems(items.slice(0, next === "showcase" ? 4 : 3).map((_, i) => String(i)));
  }

  const selected = selectedItems.map((i) => items[Number(i)]).filter(Boolean);
  const content = { eyebrow, headline, body, ctaLabel, ctaUrl, imageUrl: imageUrl || undefined, items: selected, previewText };
  const previewHtml = useMemo(() => {
    const html = renderMarketingEmail(template, brand, content, { unsubscribeUrl: "#" });
    return resolvedTheme === "dark" ? darkenEmailPreview(html) : html;
  }, [template, brand, content, resolvedTheme]);

  async function uploadHeaderImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadMessage("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadMessage("Image must be 10MB or smaller.");
      return;
    }
    setUploadingImage(true);
    setUploadMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.url) throw new Error(result?.error || "Image upload failed.");
      setImageUrl(result.url);
      setUploadMessage("Header image uploaded.");
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function toggleItem(index: number) {
    setSelectedItems((current) => current.includes(String(index)) ? current.filter((x) => x !== String(index)) : [...current, String(index)].slice(-4));
  }

  function submit() {
    setMessage(null);
    const input: MarketingSendInput = { template, subject, previewText, eyebrow, headline, body, ctaLabel, ctaUrl, imageUrl: imageUrl || undefined, items: selected };
    startTransition(async () => {
      const result = await sendMarketingCampaign(slug, input, manualEmails);
      if (result.success) {
        const invalidNote = result.data.invalid ? ` · ${result.data.invalid} entered email${result.data.invalid === 1 ? " wasn't" : "s weren't"} valid and were skipped` : "";
        setMessage(`Campaign sent to ${result.data.sent} recipient${result.data.sent === 1 ? "" : "s"}${result.data.failed ? ` · ${result.data.failed} failed` : ""}${invalidNote}.`);
      } else setMessage(result.error ?? "Could not send campaign.");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
      <section className="space-y-5">
        <div className="rounded-2xl border bg-background p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">Choose an email design</p><p className="mt-1 text-xs text-muted-foreground">BizNest adapts each design to this business&apos;s logo, colors, imagery, typography and industry.</p></div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => changeTemplate(t.id)} className={`rounded-xl border p-3 text-left transition ${template === t.id ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
                <div className="mb-2 flex items-center justify-between"><span className="text-lg">{t.icon}</span>{template === t.id && <Check className="h-4 w-4 text-primary" />}</div>
                <p className="text-sm font-semibold">{t.name}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-background p-5">
          <div className="mb-5 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Write your campaign</h2></div>
          <div className="grid gap-4">
            <Field label="Email subject" value={subject} onChange={setSubject} placeholder="Your subject line" />
            <Field label="Preview text" value={previewText} onChange={setPreviewText} placeholder="The small line shown beside the subject" />
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Eyebrow" value={eyebrow} onChange={setEyebrow} /><Field label="Button label" value={ctaLabel} onChange={setCtaLabel} /></div>
            <Field label="Headline" value={headline} onChange={setHeadline} />
            <label className="grid gap-1.5"><span className="text-xs font-medium">Message</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>
            <div className="grid gap-4">
              <Field label="Button URL" value={ctaUrl} onChange={setCtaUrl} />
              <div className="grid gap-1.5 min-w-0">
                <span className="text-xs font-medium">Header / cover image</span>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste image URL or upload" className="min-w-0 w-full flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadHeaderImage(file); }} />
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold hover:border-primary disabled:opacity-50 sm:w-auto">{uploadingImage ? "Uploading…" : "Upload image"}</button>
                </div>
                <p className="text-[11px] text-muted-foreground">This image becomes the campaign header/hero cover and updates the preview immediately.</p>
                {uploadMessage && <p className="text-[11px] font-medium">{uploadMessage}</p>}
              </div>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="rounded-2xl border bg-background p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Business images &amp; listings</h2><p className="mt-1 text-xs text-muted-foreground">Pick items to turn the email into a real visual campaign. These come directly from the storefront.</p></div><ImageIcon className="h-4 w-4 text-primary" /></div>
            <div className="space-y-5">
              {(["product", "service"] as const).map((kind) => {
                const available = items.map((item, index) => ({ item, index })).filter(({ item }) => item.kind === kind);
                if (!available.length) return null;
                const label = kind === "product" ? "Advertise products" : "Advertise services";
                return <div key={kind}>
                  <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">{label}</p><span className="text-[10px] text-muted-foreground">Select up to 4 total</span></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {available.map(({ item, index }) => { const on = selectedItems.includes(String(index)); return <button key={`${kind}-${item.name}-${index}`} type="button" onClick={() => toggleItem(index)} className={`flex gap-3 rounded-xl border p-2 text-left ${on ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><div className="mb-1 flex items-center gap-1.5"><span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase">{kind}</span>{on ? <Check className="h-3.5 w-3.5 text-primary" /> : null}</div><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.description ?? ""}</p></div></button>; })}
                  </div>
                </div>;
              })}
              {!items.length && <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No published products or services are available to advertise yet.</p>}
            </div>
          </div>
        )}

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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
          <div><p className="text-sm font-semibold">Ready to send?</p><p className="mt-1 text-xs text-muted-foreground">Goes to active, opted-in newsletter subscribers plus any manually entered emails above.</p></div>
          <button type="button" disabled={isPending || totalRecipients === 0} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{isPending ? "Sending…" : `Send to ${totalRecipients} recipient${totalRecipients === 1 ? "" : "s"}`}</button>
        </div>
        {message && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{message}</div>}
      </section>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Live email preview</p><p className="text-xs text-muted-foreground">Changes appear here instantly. The preview text is shown as it would appear beside the subject in an inbox.</p></div><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">MOBILE + DESKTOP</span></div>
        <div className="bn-email-inbox-preview mb-3 overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b bg-muted/40 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inbox preview</p>
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{brand.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm font-semibold">{brand.name}</p>
                  <p className="ml-auto shrink-0 text-[10px] text-muted-foreground">Now</p>
                </div>
                <p className="truncate text-sm font-medium">{subject || "Your subject line"}</p>
                <p className="truncate text-xs text-muted-foreground">{previewText || "The small line shown beside the subject"}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bn-email-preview-frame overflow-hidden rounded-2xl border bg-[var(--bn-admin-surface-2)] p-3 shadow-sm"><iframe key={previewHtml} title="Email preview" srcDoc={previewHtml} className="h-[760px] w-full rounded-xl bg-[var(--bn-admin-surface)]" /></div>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="grid gap-1.5"><span className="text-xs font-medium">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>;
}