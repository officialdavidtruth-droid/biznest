"use client";

import { useState, type FormEvent } from "react";
import { CV_ACCEPT, CV_ALLOWED_TYPES, CV_MAX_BYTES, CV_TYPE_HINT } from "@/lib/recruitment-cv";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";

export function CareersApplyForm({ slug, jobId, jobTitle }: { slug: string; jobId: string; jobTitle: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("cvFile");
    if (file instanceof File && file.size > 0) {
      if (!CV_ALLOWED_TYPES.has(file.type)) return setError(`Unsupported CV type. Use ${CV_TYPE_HINT}.`);
      if (file.size > CV_MAX_BYTES) return setError("Your CV must be 4MB or smaller.");
    } else fd.delete("cvFile");
    setError(""); setState("sending");
    try {
      const res = await fetch(`/api/store/${slug}/careers/apply`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Something went wrong. Please try again."); setState("idle"); return; }
      setState("done");
    } catch { setError("Couldn't reach the server. Check your connection and try again."); setState("idle"); }
  };

  if (state === "done") {
    return <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">Thank you — your application for {jobTitle} has been received. We'll be in touch if you're shortlisted.</p>;
  }
  return (
    <form onSubmit={submit} className="mt-3 grid gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">First name *<input name="firstName" required maxLength={80} autoComplete="given-name" className={input} /></label>
        <label className="grid gap-1 text-xs font-semibold">Last name *<input name="lastName" required maxLength={80} autoComplete="family-name" className={input} /></label>
        <label className="grid gap-1 text-xs font-semibold">Email *<input name="email" type="email" required autoComplete="email" className={input} /></label>
        <label className="grid gap-1 text-xs font-semibold">Phone<input name="phone" type="tel" maxLength={30} autoComplete="tel" className={input} /></label>
        <label className="grid gap-1 text-xs font-semibold">Current role<input name="currentRole" maxLength={120} className={input} /></label>
        <label className="grid gap-1 text-xs font-semibold">Location<input name="location" maxLength={120} className={input} /></label>
      </div>
      <label className="grid gap-1 text-xs font-semibold">CV * ({CV_TYPE_HINT})<input name="cvFile" type="file" accept={CV_ACCEPT} className={input} /></label>
      <label className="grid gap-1 text-xs font-semibold">…or a link to your CV<input name="cvLink" type="url" placeholder="https://…" className={input} /></label>
      <label className="grid gap-1 text-xs font-semibold">Cover note<textarea name="coverNote" rows={4} maxLength={2000} className={input} /></label>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      <button disabled={state === "sending"} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
