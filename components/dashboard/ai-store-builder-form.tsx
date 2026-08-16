"use client";

import { useState } from "react";
import { toast } from "sonner";
import { generateAiStoreDraft, applyAiStoreDraft } from "@/lib/actions/ai-store-builder";
import type { StoreDraft } from "@/lib/ai/store-builder";

export function AiStoreBuilderForm({ slug, defaultDescription }: { slug: string; defaultDescription: string }) {
  const [description, setDescription] = useState(defaultDescription);
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateAiStoreDraft(slug, description);
    setGenerating(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDraft(result.data);
  }

  async function handleApply() {
    if (!draft) return;
    setApplying(true);
    const result = await applyAiStoreDraft(slug, draft);
    setApplying(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Applied! Your homepage, about, FAQ, and SEO are updated — review them on your store.");
  }

  function updateDraft<K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <label className="text-sm font-medium">Tell us about your business</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="I sell women's clothing in Abuja. I specialize in ready-to-wear dresses and ship nationwide."
          className="mt-1 w-full rounded-md border border-border bg-background p-3 text-sm"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || description.trim().length < 10}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {generating ? "Generating your store…" : draft ? "Regenerate" : "Generate my store"}
        </button>
      </div>

      {draft && (
        <div className="space-y-5 rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">
            Review and edit anything below, then apply it to your live store.
          </p>

          <Field label="Store name ideas" value={draft.storeNameSuggestions.join(" · ")} readOnly />

          <div className="grid grid-cols-3 gap-2">
            {(["primary", "secondary", "accent"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="h-6 w-6 shrink-0 rounded border border-border"
                  style={{ backgroundColor: draft.colorPalette[k] }}
                />
                <input
                  value={draft.colorPalette[k]}
                  onChange={(e) => updateDraft("colorPalette", { ...draft.colorPalette, [k]: e.target.value })}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>

          <Field label="Hero headline" value={draft.heroHeadline} onChange={(v) => updateDraft("heroHeadline", v)} />
          <Field label="Hero subtitle" value={draft.heroSubtitle} onChange={(v) => updateDraft("heroSubtitle", v)} />
          <Field label="About heading" value={draft.aboutHeading} onChange={(v) => updateDraft("aboutHeading", v)} />
          <Field label="About body" value={draft.aboutBody} onChange={(v) => updateDraft("aboutBody", v)} textarea />
          <Field
            label="Product categories"
            value={draft.productCategories.join(", ")}
            onChange={(v) => updateDraft("productCategories", v.split(",").map((s) => s.trim()).filter(Boolean))}
          />
          <Field label="SEO title" value={draft.seoTitle} onChange={(v) => updateDraft("seoTitle", v)} />
          <Field label="SEO description" value={draft.seoDescription} onChange={(v) => updateDraft("seoDescription", v)} textarea />
          <Field label="WhatsApp CTA" value={draft.whatsappCta} onChange={(v) => updateDraft("whatsappCta", v)} />
          <Field label="Delivery note" value={draft.deliveryNote} onChange={(v) => updateDraft("deliveryNote", v)} />
          <Field label="Social bio" value={draft.socialBio} onChange={(v) => updateDraft("socialBio", v)} textarea />

          <div>
            <span className="text-sm font-medium">FAQ</span>
            <div className="mt-1 space-y-2">
              {draft.faq.map((f, i) => (
                <div key={i} className="rounded border border-border p-2 text-xs">
                  <input
                    value={f.question}
                    onChange={(e) => {
                      const next = [...draft.faq];
                      next[i] = { ...next[i], question: e.target.value };
                      updateDraft("faq", next);
                    }}
                    className="w-full bg-transparent font-medium outline-none"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => {
                      const next = [...draft.faq];
                      next[i] = { ...next[i], answer: e.target.value };
                      updateDraft("faq", next);
                    }}
                    className="mt-1 w-full resize-none bg-transparent text-muted-foreground outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Sample products (suggestions — create these manually in Products)</span>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {draft.sampleProducts.map((p, i) => (
                <li key={i}>
                  {p.name} — ₦{p.suggestedPriceNaira.toLocaleString("en-NG")} — {p.description}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleApply}
            disabled={applying}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {applying ? "Applying to your store…" : "Apply to my store"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  textarea,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        />
      ) : (
        <input
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        />
      )}
    </div>
  );
}
