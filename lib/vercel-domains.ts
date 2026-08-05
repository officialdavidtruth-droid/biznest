/**
 * Adds/checks custom domains on this Vercel project via Vercel's REST API,
 * so an Enterprise/Business Mogul vendor's own domain (e.g. mystore.com)
 * actually gets attached to the deployment, not just recorded in our DB.
 *
 * Docs: https://vercel.com/docs/rest-api/endpoints/domains
 */

const BASE = "https://api.vercel.com";

function teamQuery(): string {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : "";
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export type VercelDomainResult =
  | { ok: true; verified: boolean }
  | { ok: false; error: string };

/** Attaches a domain to this Vercel project. Idempotent-ish — Vercel returns 409 if already attached, which we treat as success. */
export async function addDomainToVercel(domain: string): Promise<VercelDomainResult> {
  if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    return { ok: false, error: "Vercel API not configured on the server (VERCEL_API_TOKEN/VERCEL_PROJECT_ID)." };
  }

  const res = await fetch(
    `${BASE}/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains${teamQuery()}`,
    { method: "POST", headers: headers(), body: JSON.stringify({ name: domain }) }
  );
  const body = await res.json();

  if (res.status === 409) {
    // Already attached (to this project) — fine, proceed to check verification.
    return checkDomainStatus(domain);
  }
  if (!res.ok) {
    return { ok: false, error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }
  return { ok: true, verified: Boolean(body.verified) };
}

/** Vercel's verification status for a domain already attached to the project. */
export async function checkDomainStatus(domain: string): Promise<VercelDomainResult> {
  if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    return { ok: false, error: "Vercel API not configured on the server." };
  }

  const res = await fetch(
    `${BASE}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}${teamQuery()}`,
    { headers: headers() }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }
  const body = await res.json();
  return { ok: true, verified: Boolean(body.verified) };
}

export async function removeDomainFromVercel(domain: string): Promise<void> {
  if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_PROJECT_ID) return;
  await fetch(
    `${BASE}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}${teamQuery()}`,
    { method: "DELETE", headers: headers() }
  ).catch(() => {}); // best-effort — a failed cleanup shouldn't block the calling action
}
