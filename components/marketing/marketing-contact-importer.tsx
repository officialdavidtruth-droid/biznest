"use client";

import { useState, useTransition } from "react";
import { UploadCloud, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { importMarketingContacts, type MarketingContactInput } from "@/lib/actions/marketing-workspace";

function parse(text: string): MarketingContactInput[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (line: string) => line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]);
  const emailIndex = first.findIndex((x) => /email/i.test(x));
  const nameIndex = first.findIndex((x) => /name/i.test(x));
  const hasHeader = emailIndex >= 0;
  const rows = hasHeader ? lines.slice(1) : lines;
  const idx = hasHeader ? emailIndex : 0;
  return rows.map((row) => {
    const cells = split(row);
    return { email: cells[idx] ?? "", name: hasHeader ? cells[nameIndex] : undefined };
  }).filter((x) => x.email);
}

export function MarketingContactImporter({ slug }: { slug: string }) {
  const [contacts, setContacts] = useState<MarketingContactInput[]>([]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  async function fileSelected(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setMessage("Use a CSV or TXT file."); return; }
    setContacts(parse(await file.text()));
    setMessage("");
  }

  function importNow() {
    start(async () => {
      const result = await importMarketingContacts(slug, contacts);
      if (result.success) {
        setMessage(`${result.data.imported.toLocaleString()} contacts imported into your audience, CRM and Customer 360.`);
        setContacts([]);
      } else setMessage(result.error || "Import failed.");
    });
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Grow your audience</p><h2 className="mt-1 text-xl font-black">Import customers and leads</h2><p className="mt-1 text-sm text-slate-500">One import feeds your email audience, CRM pipeline and Customer 360. No storefront required.</p></div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"><UploadCloud className="h-4 w-4" />Choose CSV/TXT<input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => void fileSelected(e.target.files?.[0])} /></label>
      </div>
      {contacts.length > 0 && <div className="mt-5 rounded-2xl bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><Users className="h-4 w-4" />{contacts.length.toLocaleString()} contacts ready</div><p className="mt-1 text-xs text-emerald-700">They will be deduplicated and added to your marketing audience and CRM.</p><button type="button" disabled={pending} onClick={importNow} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Importing…" : "Import contacts"}</button></div>}
      {message && <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}
    </section>
  );
}
