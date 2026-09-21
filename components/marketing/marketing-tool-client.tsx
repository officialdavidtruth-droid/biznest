"use client";

import { useMemo, useState } from "react";

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

export function MarketingToolClient() {
  const [manualText, setManualText] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");
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

  return (
    <section id="contacts" className="mx-auto max-w-6xl px-5 py-14">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-400">Contact manager</p>
        <h2 className="mt-2 text-3xl font-extrabold text-white">Add your email list</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          Upload a CSV/TXT file or paste addresses directly. We recognize emails separated by spaces, commas, semicolons, or new lines, then remove duplicates.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h3 className="text-lg font-bold text-white">Paste emails manually</h3>
          <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="manual-emails">Email addresses</label>
          <textarea id="manual-emails" rows={6} value={manualText} onChange={e => setManualText(e.target.value)} placeholder={"example@gmail.com example2@gmail.com\nor one address per line"} className={field + " resize-y"} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-300">{manualContacts.length} valid unique email(s) detected</span>
            <button disabled={!manualContacts.length} onClick={addManual} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Add to contact list</button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h3 className="text-lg font-bold text-white">Upload a contact document</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">CSV or TXT supported. CSV may include an Email column and optional Name column. For .xlsx/.xls, export the worksheet as CSV first.</p>
          <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800 px-4 text-center hover:border-orange-400">
            <span className="font-bold text-white">Choose CSV or TXT file</span>
            <span className="mt-2 text-sm text-slate-300">Select from your device</span>
            <input type="file" accept=".csv,.txt" className="mt-4 max-w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" onChange={e => void onFile(e.target.files?.[0])} />
          </label>
          {fileName && <p className="mt-3 text-sm text-slate-300">Selected: {fileName}</p>}
        </div>
      </div>
      {notice && <p role="status" className="mt-5 rounded-xl border border-blue-700 bg-blue-950 px-4 py-3 text-sm text-blue-100">{notice}</p>}
      <div className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Contact list preview</h3>
            <p className="mt-1 text-sm text-slate-300">{contacts.length} unique valid contact(s)</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setContacts([]); setFileName(""); setNotice("Contact preview cleared."); }} disabled={!contacts.length} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Clear</button>
            <button onClick={downloadCsv} disabled={!contacts.length} className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">Export cleaned CSV</button>
          </div>
        </div>
        {contacts.length > 0 ? (
          <div className="mt-5 max-h-72 overflow-auto rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-800 text-slate-100">
                <tr><th className="p-3">Email</th><th className="p-3">Name</th></tr>
              </thead>
              <tbody>
                {contacts.slice(0, 250).map(c => (
                  <tr key={c.email} className="border-t border-slate-700">
                    <td className="p-3 text-slate-100">{c.email}</td>
                    <td className="p-3 text-slate-300">{c.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-xl bg-slate-800 px-4 py-8 text-center text-slate-300">Your imported and pasted contacts will appear here.</div>
        )}
        <p className="mt-3 text-xs leading-5 text-slate-400">This page currently previews and exports contacts in your browser. Saving contacts to your account and sending campaigns require backend integration. Only upload contacts you have permission to use.</p>
      </div>
    </section>
  );
}
