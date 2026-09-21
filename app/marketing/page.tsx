"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Contact = { email: string; name?: string };
function parseCsv(text: string): Contact[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((r) => r.trim());
  if (!rows.length) return [];
  const split = (line: string) => {
    const out: string[] = []; let cell = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) { out.push(cell.trim()); cell = ""; }
      else cell += c;
    }
    out.push(cell.trim()); return out;
  };
  const first = split(rows[0]);
  const emailIndex = first.findIndex((v) => /^(e-?mail|email address)$/i.test(v.trim()));
  const hasHeader = emailIndex >= 0;
  const idx = hasHeader ? emailIndex : first.findIndex((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  if (idx < 0) return [];
  const nameIndex = hasHeader ? first.findIndex((v) => /^(name|full name|first name)$/i.test(v.trim())) : -1;
  const data = hasHeader ? rows.slice(1) : rows;
  const unique = new Map<string, Contact>();
  for (const row of data) {
    const cells = split(row); const email = (cells[idx] || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !unique.has(email))
      unique.set(email, { email, name: nameIndex >= 0 ? cells[nameIndex] : undefined });
  }
  return [...unique.values()];
}

export default function MarketingStandalonePage() {
  const [fileName, setFileName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<"welcome" | "signup" | "dashboard">("welcome");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [consent, setConsent] = useState(false);
  const valid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  async function onFile(file?: File) {
    if (!file) return;
    setFileName(file.name); setNotice("");
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setContacts([]); setNotice("This starter upload accepts CSV files. Save your Excel sheet as CSV, then upload it."); return;
    }
    const parsed = parseCsv(await file.text());
    setContacts(parsed);
    setNotice(parsed.length ? `${parsed.length} unique valid email address(es) found. Review before importing.` : "No valid email column or email addresses found. Include an Email column and try again.");
  }

  return <main className="min-h-screen" style={{ background: "var(--bn-ink)", color: "var(--bn-ivory)" }}>
    <header className="border-b px-6 py-5" style={{ borderColor: "var(--bn-ink-line)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-xl font-bold">BizNest <span style={{color:"var(--bn-marigold)"}}>Marketing</span></Link>
        <Link href="/login" className="text-sm underline">Sign in</Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-6 py-12">
      {step === "welcome" && <section className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em]" style={{color:"var(--bn-marigold)"}}>Standalone marketing suite</p>
        <h1 className="mt-4 text-4xl font-bold sm:text-6xl">Grow your audience.<br/>No online store needed.</h1>
        <p className="mx-auto mt-5 max-w-xl text-base" style={{color:"var(--bn-mute)"}}>Run marketing campaigns, organize contacts, and track engagement with a dedicated BizNest Marketing account.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={()=>setStep("signup")} className="rounded-full px-7 py-3 font-semibold" style={{background:"var(--bn-accent-gradient)",color:"var(--bn-ink)"}}>Get started</button>
          <a href="#features" className="rounded-full border px-7 py-3" style={{borderColor:"var(--bn-ink-line)"}}>Explore features</a>
        </div>
        <p className="mt-4 text-xs" style={{color:"var(--bn-mute)"}}>Monthly subscription · Price set by BizNest Superadmin · No government ID required</p>
        <div id="features" className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Email audience","Import and organize contact lists with duplicate detection."],
            ["Campaign workspace","Plan and manage marketing campaigns in one place."],
            ["Performance insights","Review campaign results and improve future outreach."]
          ].map(([title,desc])=><article key={title} className="rounded-2xl border p-5" style={{borderColor:"var(--bn-ink-line)"}}><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm" style={{color:"var(--bn-mute)"}}>{desc}</p></article>)}
        </div>
      </section>}
      {step === "signup" && <section className="mx-auto max-w-xl rounded-3xl border p-7 sm:p-9" style={{borderColor:"var(--bn-ink-line)"}}>
        <button onClick={()=>setStep("welcome")} className="mb-5 text-sm underline">← Back</button>
        <h1 className="text-3xl font-bold">Create a Marketing account</h1>
        <p className="mt-2 text-sm" style={{color:"var(--bn-mute)"}}>No store setup or government ID required. Subscription payment is required to activate access.</p>
        <form className="mt-7 space-y-4" onSubmit={(e)=>{e.preventDefault();setNotice("Account creation and checkout must be connected to BizNest authentication and verified payment before enabling access.");}}>
          <label className="block text-sm">Your name<input required className="mt-1 w-full rounded-xl border bg-transparent p-3" style={{borderColor:"var(--bn-ink-line)"}} value={business} onChange={e=>setBusiness(e.target.value)} placeholder="Name or business name"/></label>
          <label className="block text-sm">Email address<input required type="email" className="mt-1 w-full rounded-xl border bg-transparent p-3" style={{borderColor:"var(--bn-ink-line)"}} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to the terms and confirm I have permission to use any contact data I upload.</label>
          <button disabled={!valid||!business.trim()||!consent} className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-40" style={{background:"var(--bn-accent-gradient)",color:"var(--bn-ink)"}}>Continue to subscription</button>
        </form>
        {notice&&<p role="status" className="mt-4 rounded-xl border p-3 text-sm" style={{borderColor:"var(--bn-ink-line)"}}>{notice}</p>}
      </section>}
      {step === "dashboard" && <section><h1 className="text-3xl font-bold">Marketing dashboard</h1></section>}
      {step === "welcome" && <section className="mx-auto mt-8 max-w-3xl rounded-2xl border p-5" style={{borderColor:"var(--bn-ink-line)"}}>
        <h2 className="font-semibold">Already have a contact list?</h2><p className="mt-1 text-sm" style={{color:"var(--bn-mute)"}}>CSV import preview is available below. For .xlsx/.xls, export the worksheet to CSV first.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed p-7 text-center" style={{borderColor:"var(--bn-ink-line)"}}>
          <span className="font-semibold">Choose CSV file</span><span className="mt-1 text-xs" style={{color:"var(--bn-mute)"}}>CSV or TXT · Email column recommended</span>
          <input type="file" accept=".csv,.txt" className="mt-4 max-w-full text-sm" onChange={e=>void onFile(e.target.files?.[0])}/>
        </label>
        {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
        {fileName&&<p className="mt-2 text-xs" style={{color:"var(--bn-mute)"}}>Selected: {fileName}</p>}
        {contacts.length>0&&<><div className="mt-4 flex items-center justify-between"><strong>{contacts.length} contacts previewed</strong><button className="text-sm underline" onClick={()=>{const blob=new Blob([["email,name",...contacts.map(c=>`${c.email},${(c.name||"").replace(/,/g," ")}`)].join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="validated-contacts.csv";a.click();URL.revokeObjectURL(url);}}>Download cleaned CSV</button></div><div className="mt-3 max-h-64 overflow-auto rounded-xl border" style={{borderColor:"var(--bn-ink-line)"}}><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Email</th><th className="p-3">Name</th></tr></thead><tbody>{contacts.slice(0,100).map(c=><tr key={c.email} className="border-t" style={{borderColor:"var(--bn-ink-line)"}}><td className="p-3">{c.email}</td><td className="p-3">{c.name||"—"}</td></tr>)}</tbody></table></div><p className="mt-2 text-xs" style={{color:"var(--bn-mute)"}}>Showing up to 100 rows. This is a local preview; persistent import requires the authenticated, subscription-gated backend.</p></>}
      </section>}
    </div>
  </main>;
}
