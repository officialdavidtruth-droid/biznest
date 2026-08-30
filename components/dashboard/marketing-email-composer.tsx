"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Image as ImageIcon, Mail, Send, Sparkles, X } from "lucide-react";
import {
  MARKETING_TEMPLATES,
  defaultMarketingContent,
  renderMarketingEmail,
  type MarketingBrand,
  type MarketingItem,
  type MarketingTemplateId,
} from "@/lib/email/marketing-templates";
import { sendMarketingCampaign, type MarketingSendInput } from "@/lib/actions/marketing";

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

  function changeTemplate(next: MarketingTemplateId) {
    setTemplate(next);
    const d = defaultMarketingContent(next, brand, items);
    setEyebrow(d.eyebrow); setHeadline(d.headline); setBody(d.body); setCtaLabel(d.ctaLabel); setCtaUrl(d.ctaUrl); setImageUrl(d.imageUrl ?? ""); setPreviewText(d.previewText ?? d.headline);
    setSelectedItems(items.slice(0, next === "showcase" ? 4 : 3).map((_, i) => String(i)));
  }

  const selected = selectedItems.map((i) => items[Number(i)]).filter(Boolean);
  const content = { eyebrow, headline, body, ctaLabel, ctaUrl, imageUrl: imageUrl || undefined, items: selected, previewText };
  const previewHtml = renderMarketingEmail(template, brand, content, { unsubscribeUrl: "#" });

  function toggleItem(index: number) {
    setSelectedItems((current) => current.includes(String(index)) ? current.filter((x) => x !== String(index)) : [...current, String(index)].slice(-4));
  }

  function submit() {
    setMessage(null);
    const input: MarketingSendInput = { template, subject, previewText, eyebrow, headline, body, ctaLabel, ctaUrl, imageUrl: imageUrl || undefined, items: selected };
    startTransition(async () => {
      const result = await sendMarketingCampaign(slug, input);
      if (result.success) setMessage(`Campaign sent to ${result.data.sent} subscriber${result.data.sent === 1 ? "" : "s"}${result.data.failed ? ` · ${result.data.failed} failed` : ""}.`);
      else setMessage(result.error ?? "Could not send campaign.");
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
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Button URL" value={ctaUrl} onChange={setCtaUrl} /><Field label="Hero image URL (optional)" value={imageUrl} onChange={setImageUrl} /></div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="rounded-2xl border bg-background p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Business images &amp; listings</h2><p className="mt-1 text-xs text-muted-foreground">Pick items to turn the email into a real visual campaign. These come directly from the storefront.</p></div><ImageIcon className="h-4 w-4 text-primary" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => { const on = selectedItems.includes(String(index)); return <button key={`${item.name}-${index}`} type="button" onClick={() => toggleItem(index)} className={`flex gap-3 rounded-xl border p-2 text-left ${on ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.description ?? ""}</p></div>{on ? <Check className="ml-auto h-4 w-4 shrink-0 text-primary" /> : null}</button>; })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
          <div><p className="text-sm font-semibold">Ready to send?</p><p className="mt-1 text-xs text-muted-foreground">Only active, opted-in newsletter subscribers receive marketing emails.</p></div>
          <button type="button" disabled={isPending || activeSubscribers === 0} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{isPending ? "Sending…" : `Send to ${activeSubscribers} subscriber${activeSubscribers === 1 ? "" : "s"}`}</button>
        </div>
        {message && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{message}</div>}
      </section>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Live email preview</p><p className="text-xs text-muted-foreground">This is the actual responsive HTML style subscribers will receive.</p></div><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">MOBILE + DESKTOP</span></div>
        <div className="overflow-hidden rounded-2xl border bg-[#e5e7eb] p-3 shadow-sm"><iframe title="Email preview" srcDoc={previewHtml} className="h-[760px] w-full rounded-xl bg-white" /></div>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="grid gap-1.5"><span className="text-xs font-medium">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>;
}
