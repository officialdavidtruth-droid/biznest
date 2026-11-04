"use client";

import { Plus, X } from "lucide-react";
import type { ServiceContent } from "@/lib/service-content";

type Article = { value: string; label: string };

const add = "flex items-center gap-1 text-xs font-medium text-primary hover:underline";
const rm = "rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive";

function Block({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function StringList({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input flex-1" value={it} placeholder={placeholder} maxLength={160} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label="Remove" className={rm} onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" className={add} onClick={() => onChange([...items, ""])}><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

/**
 * "Page content" for a service/package: the blocks that make its storefront page more than a price and a
 * button. Everything is optional; empty blocks simply don't appear on the page.
 */
export function ServiceContentEditor({
  value, onChange, noun, itineraryLabel, articles,
}: {
  value: ServiceContent;
  onChange: (v: ServiceContent) => void;
  /** "package", "service", "room"… */
  noun: string;
  itineraryLabel: string;
  articles: Article[];
}) {
  const set = <K extends keyof ServiceContent>(k: K, v: ServiceContent[K]) => onChange({ ...value, [k]: v });

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold">Page content</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Everything below is optional and appears on this {noun}&apos;s page only when you fill it in. Use it like a mini article: tell the story, list what&apos;s
        included, answer questions — then let customers book or send an enquiry.
      </p>

      <div className="space-y-4">
        <Block title="Full description" hint={`The longer write-up for this ${noun} — what it is, who it's for, what to expect. Supports **bold**, _italic_ and "- " bullet lists.`}>
          <textarea className="input min-h-40" maxLength={8000} value={value.story} placeholder="Write as much as you like…" onChange={(e) => set("story", e.target.value)} />
        </Block>

        <Block title="Key details" hint='Short facts shown as a tidy list, e.g. "Duration: 5 days", "Group size: up to 12", "Flights: included".'>
          <div className="space-y-2">
            {value.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input w-2/5" placeholder="Label" maxLength={60} value={h.label} onChange={(e) => set("highlights", value.highlights.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input flex-1" placeholder="Detail" maxLength={160} value={h.value} onChange={(e) => set("highlights", value.highlights.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <button type="button" aria-label="Remove" className={rm} onClick={() => set("highlights", value.highlights.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className={add} onClick={() => set("highlights", [...value.highlights, { label: "", value: "" }])}><Plus className="h-3.5 w-3.5" /> Add detail</button>
          </div>
        </Block>

        <Block title={itineraryLabel} hint="Step by step — one entry per day, stage or session.">
          <div className="space-y-3">
            {value.itinerary.map((d, i) => (
              <div key={i} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <input className="input flex-1" placeholder="Title, e.g. Arrival & Stone Town tour" maxLength={160} value={d.title} onChange={(e) => set("itinerary", value.itinerary.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <button type="button" aria-label="Remove" className={rm} onClick={() => set("itinerary", value.itinerary.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>
                <textarea className="input min-h-20" placeholder="What happens" maxLength={1000} value={d.text} onChange={(e) => set("itinerary", value.itinerary.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" className={add} onClick={() => set("itinerary", [...value.itinerary, { title: "", text: "" }])}><Plus className="h-3.5 w-3.5" /> Add step</button>
          </div>
        </Block>

        <div className="grid gap-4 md:grid-cols-2">
          <Block title="What's included" hint="One item per line.">
            <StringList items={value.included} onChange={(v) => set("included", v)} placeholder="e.g. Return flights" addLabel="Add item" />
          </Block>
          <Block title="Not included" hint="Optional — avoids surprises later.">
            <StringList items={value.excluded} onChange={(v) => set("excluded", v)} placeholder="e.g. Visa fees" addLabel="Add item" />
          </Block>
        </div>

        <Block title="Questions & answers" hint="The things customers always ask before booking.">
          <div className="space-y-3">
            {value.faqs.map((f, i) => (
              <div key={i} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input className="input flex-1" placeholder="Question" maxLength={160} value={f.q} onChange={(e) => set("faqs", value.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                  <button type="button" aria-label="Remove" className={rm} onClick={() => set("faqs", value.faqs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>
                <textarea className="input min-h-16" placeholder="Answer" maxLength={1000} value={f.a} onChange={(e) => set("faqs", value.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" className={add} onClick={() => set("faqs", [...value.faqs, { q: "", a: "" }])}><Plus className="h-3.5 w-3.5" /> Add question</button>
          </div>
        </Block>

        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Location / meeting point" hint="Leave empty to show your business address.">
            <input className="input" maxLength={200} value={value.location} placeholder="e.g. Zanzibar, Tanzania" onChange={(e) => set("location", e.target.value)} />
          </Block>
          <Block title="Related article" hint="Link to a blog article that tells more, e.g. a destination guide.">
            <select className="input" value={value.article} onChange={(e) => set("article", e.target.value)}>
              <option value="">None</option>
              {articles.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            {articles.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Publish an article in Blogs first and it will appear here.</p>}
          </Block>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={value.enquiry ?? false} onChange={(e) => set("enquiry", e.target.checked)} />
          <span>
            <b>Show an enquiry form on this page</b>
            <span className="block text-xs text-muted-foreground">Visitors can send a question or request; it lands in your enquiries/leads. Works alongside booking.</span>
          </span>
        </label>
      </div>
    </section>
  );
}
