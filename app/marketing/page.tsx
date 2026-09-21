"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Contact = { email: string; name?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dedupe(items: Contact[]) {
  const unique = new Map<string, Contact>();
  for (const item of items) {
    const email = item.email.trim().toLowerCase();
    if (EMAIL_RE.test(email) && !unique.has(email)) unique.set(email, { ...item, email });
  }
  return [...unique.values()];
}

function extractEmails(text: string): Contact[] {
  // Supports pasted lists separated by whitespace, commas, semicolons, or new lines.
  const matches = text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi) || [];
  return dedupe(matches.map(email => ({ email })));
}

function parseCsv(text: string): Contact[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
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
  const first = split(lines[0]);
  const emailIndex = first.findIndex(v => /^(e-?mail|email address)$/i.test(v.trim()));
  const hasHeader = emailIndex >= 0;
  const idx = hasHeader ? emailIndex : first.findIndex(v => EMAIL_RE.test(v));
  if (idx < 0) return extractEmails(text);
  const nameIndex = hasHeader ? first.findIndex(v => /^(name|full name|first name)$/i.test(v.trim())) : -1;
  const rows = hasHeader ? lines.slice(1) : lines;
  return dedupe(rows.map(row => {
    const cells = split(row);
    return { email: cells[idx] || "", name: nameIndex >= 0 ? cells[nameIndex] : undefined };
  }));
}

export default function MarketingStandalonePage() {
  const [step, setStep] = useState<"welcome" | "signup">("welcome");
  const [manualText, setManualText] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const manualContacts = useMemo(() => extractEmails(manualText), [manualText]);

  async function onFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setNotice("Please upload CSV or TXT. For Excel, save the worksheet as CSV first.");
      return;
    }
    const parsed = parseCsv(await file.text());
    setContacts(current => dedupe([...current, ...parsed]));
    setNotice(`${parsed.length} valid unique address(es) found in file. Combined list is deduplicated.`);
  }

  function addManual() {
    const found = extractEmails(manualText);
    setContacts(current => dedupe([...current, ...found]));
    setNotice(`${found.length} valid unique address(es) added from pasted text.`);
    setManualText("");
  }

  function downloadCsv() {
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ["email,name", ...contacts.map(c => `${quote(c.email)},${quote(c.name || "")}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "biznest-contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-slate-700 bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-extrabold text-white">BizNest <span className="text-orange-400">Marketing</span></Link>
        <nav className="flex items-center gap-5 text-sm font-medium"><Link className="text-slate-200 hover:text-white" href="/">Home</Link><button onClick={() => setStep("signup")} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 hover:bg-orange-400">Sign up</button></nav>
      </div>
    </header>

    <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-orange-400">BizNest Marketing · Standalone workspace</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white sm:text-6xl">Reach your audience.<br/><span className="text-orange-400">Grow your business.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">Organize contacts, prepare campaigns, and review results—all with a Marketing account. You do not need to create an online store.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setStep("signup")} className="rounded-full bg-orange-500 px-7 py-3.5 font-bold text-slate-950 hover:bg-orange-400">Create marketing account</button><a href="#contacts" className="rounded-full border border-slate-500 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Import contacts</a></div>
          <p className="mt-4 text-sm text-slate-300">Monthly subscription · Pricing configured by BizNest Superadmin · No government ID required</p>
        </div>
        <div className="rounded-3xl border border-blue-800 bg-slate-900/80 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between"><span className="font-bold text-white">Marketing workspace</span><span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">Preview</span></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Audience</p><p className="mt-2 text-2xl font-bold text-white">Contacts</p><p className="mt-1 text-sm text-slate-400">Import or paste email lists</p></div><div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Campaigns</p><p className="mt-2 text-2xl font-bold text-white">Plan & send</p><p className="mt-1 text-sm text-slate-400">Manage outreach in one place</p></div><div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:col-span-2"><p className="text-sm text-slate-300">Insights</p><p className="mt-2 text-xl font-bold text-white">Understand engagement</p><p className="mt-1 text-sm text-slate-400">Review campaign results and improve future communication.</p></div></div>
        </div>
      </div>
    </section>

    <section id="contacts" className="mx-auto max-w-6xl px-5 py-14">
      <div className="mb-8"><p className="text-sm font-bold uppercase tracking-widest text-orange-400">Contact manager</p><h2 className="mt-2 text-3xl font-extrabold text-white">Add your email list</h2><p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">Upload a CSV/TXT file or paste addresses directly. We recognize emails separated by spaces, commas, semicolons, or new lines, then remove duplicates.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><h3 className="text-lg font-bold text-white">Paste emails manually</h3><label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="manual-emails">Email addresses</label><textarea id="manual-emails" rows={6} value={manualText} onChange={e => setManualText(e.target.value)} placeholder={"example@gmail.com example2@gmail.com\nor one address per line"} className={field + " resize-y"}/><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-300">{manualContacts.length} valid unique email(s) detected</span><button disabled={!manualContacts.length} onClick={addManual} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Add to contact list</button></div></div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6"><h3 className="text-lg font-bold text-white">Upload a contact document</h3><p className="mt-2 text-sm leading-6 text-slate-300">CSV or TXT supported. CSV may include an Email column and optional Name column. For .xlsx/.xls, export the worksheet as CSV first.</p><label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800 px-4 text-center hover:border-orange-400"><span className="font-bold text-white">Choose CSV or TXT file</span><span className="mt-2 text-sm text-slate-300">Select from your device</span><input type="file" accept=".csv,.txt" className="mt-4 max-w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" onChange={e => void onFile(e.target.files?.[0])}/></label>{fileName&&<p className="mt-3 text-sm text-slate-300">Selected: {fileName}</p>}</div>
      </div>
      {notice&&<p role="status" className="mt-5 rounded-xl border border-blue-700 bg-blue-950 px-4 py-3 text-sm text-blue-100">{notice}</p>}
      <div className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold text-white">Contact list preview</h3><p className="mt-1 text-sm text-slate-300">{contacts.length} unique valid contact(s)</p></div><div className="flex gap-3"><button onClick={() => {setContacts([]);setFileName("");setNotice("Contact preview cleared.");}} disabled={!contacts.length} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Clear</button><button onClick={downloadCsv} disabled={!contacts.length} className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">Export cleaned CSV</button></div></div>
        {contacts.length>0?<div className="mt-5 max-h-72 overflow-auto rounded-xl border border-slate-700"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-800 text-slate-100"><tr><th className="p-3">Email</th><th className="p-3">Name</th></tr></thead><tbody>{contacts.slice(0,250).map(c=><tr key={c.email} className="border-t border-slate-700"><td className="p-3 text-slate-100">{c.email}</td><td className="p-3 text-slate-300">{c.name||"—"}</td></tr>)}</tbody></table></div>:<div className="mt-5 rounded-xl bg-slate-800 px-4 py-8 text-center text-slate-300">Your imported and pasted contacts will appear here.</div>}
        <p className="mt-3 text-xs leading-5 text-slate-400">This page currently previews and exports contacts in your browser. Saving contacts to your account and sending campaigns require backend integration. Only upload contacts you have permission to use.</p>
      </div>
    </section>

    {step === "signup" && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"><section className="my-8 w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Standalone access</p><h2 className="mt-2 text-2xl font-extrabold text-white">Create your account</h2></div><button aria-label="Close sign up" onClick={()=>setStep("welcome")} className="rounded-full px-3 py-1 text-xl text-slate-300 hover:bg-slate-800">×</button></div><p className="mt-3 text-sm leading-6 text-slate-300">Sign up with your name, email, and password. No store setup or government ID is required. Subscription checkout and account activation must be connected to BizNest services.</p><form className="mt-6 space-y-4" onSubmit={e=>{e.preventDefault();setNotice("Sign-up form is a UI preview. Connect account creation, email verification, and subscription checkout to activate real accounts.");}}><label className="block text-sm font-medium text-slate-200">Full name<input required autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} className={field} placeholder="Your name"/></label><label className="block text-sm font-medium text-slate-200">Email address<input required type="email" autoComplete="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} className={field} placeholder="you@example.com"/></label><label className="block text-sm font-medium text-slate-200">Password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field} placeholder="At least 8 characters"/></label><label className="flex items-start gap-3 text-sm leading-5 text-slate-300"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-orange-500"/>I agree to the terms and confirm I have permission to use contact data I upload.</label><button className="w-full rounded-full bg-orange-500 px-5 py-3 font-bold text-slate-950 hover:bg-orange-400">Continue to subscription</button></form><p className="mt-4 text-xs text-slate-400">No payment is processed and no account is created by this prototype.</p></section></div>}
  </main>;
}
