/** Pure rules for the public careers page and apply form (no DB, safe on client and server). */

export const careersPath = (slug: string) => `/store/${slug}/careers`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export type PublicApplication = {
  firstName: string; lastName: string; email: string; phone: string | null; location: string | null;
  currentRole: string | null; currentCompany: string | null; cvLink: string | null; coverNote: string | null;
};

/** Parses the apply form. `hasCvFile` says whether a CV file accompanies it (a file or a link is required). */
export function parsePublicApplication(form: FormData, hasCvFile: boolean): { ok: true; data: PublicApplication } | { ok: false; error: string } {
  const firstName = clip(form.get("firstName"), 80), lastName = clip(form.get("lastName"), 80);
  if (!firstName || !lastName) return { ok: false, error: "Please enter your first and last name." };
  const email = clip(form.get("email"), 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  const cvLink = clip(form.get("cvLink"), 500);
  if (cvLink && !/^https?:\/\//i.test(cvLink)) return { ok: false, error: "The CV link must start with http:// or https://." };
  if (!hasCvFile && !cvLink) return { ok: false, error: "Please attach your CV or paste a link to it." };
  const note = String(form.get("coverNote") ?? "").trim().slice(0, 2000);
  return {
    ok: true,
    data: {
      firstName, lastName, email,
      phone: clip(form.get("phone"), 30) || null, location: clip(form.get("location"), 120) || null,
      currentRole: clip(form.get("currentRole"), 120) || null, currentCompany: clip(form.get("currentCompany"), 120) || null,
      cvLink: cvLink || null, coverNote: note || null,
    },
  };
}

/** "₦300,000 – ₦450,000", "From ₦300,000" or "Up to ₦450,000"; null when no range is set. */
export function formatPublicSalary(min: number | null, max: number | null, currency = "NGN"): string | null {
  if (min == null && max == null) return null;
  let f: (n: number) => string;
  try {
    const nf = new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 });
    f = (n) => nf.format(n);
  } catch { f = (n) => `${currency} ${n.toLocaleString("en-NG")}`; }
  if (min != null && max != null) return min === max ? f(min) : `${f(min)} – ${f(max)}`;
  return min != null ? `From ${f(min)}` : `Up to ${f(max as number)}`;
}

/** A job takes public applications only while OPEN and not past its closing date (a calendar date, inclusive). */
export function jobAcceptsApplications(job: { status: string; closesAt: Date | null }, now: Date = new Date()): boolean {
  if (job.status !== "OPEN") return false;
  if (!job.closesAt) return true;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return job.closesAt.getTime() >= startOfToday;
}
