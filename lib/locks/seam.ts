/**
 * Seam (https://www.seam.co) client for access-control systems such as Salto KS and ASSA ABLOY Visionline.
 * Salto KS generates the PIN itself (a custom code cannot be chosen); the stay's dates are set on the ACS user.
 * Flow per stay: create ACS user (with access schedule) -> add to the room's access group -> create a "code" credential.
 */
const SEAM_BASE = "https://connect.getseam.com";

export class SeamError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

type Fetch = typeof fetch;

async function call(fetchImpl: Fetch, apiKey: string, path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetchImpl(`${SEAM_BASE}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new SeamError(String(err?.message || `Seam returned HTTP ${res.status}.`).slice(0, 200), res.status);
  }
  return json ?? {};
}

export async function listAcsSystems(apiKey: string, fetchImpl: Fetch = fetch) {
  const j = await call(fetchImpl, apiKey, "/acs/systems/list");
  const list = Array.isArray(j.acs_systems) ? (j.acs_systems as Array<Record<string, unknown>>) : [];
  return list.map((s) => ({ id: String(s.acs_system_id), name: String(s.name || s.external_type_display_name || s.acs_system_id), type: typeof s.external_type === "string" ? s.external_type : null }));
}

export async function listAccessGroups(apiKey: string, systemId: string, fetchImpl: Fetch = fetch) {
  const j = await call(fetchImpl, apiKey, "/acs/access_groups/list", { acs_system_id: systemId });
  const list = Array.isArray(j.acs_access_groups) ? (j.acs_access_groups as Array<Record<string, unknown>>) : [];
  return list.map((g) => ({ id: String(g.acs_access_group_id), name: String(g.name || g.acs_access_group_id) }));
}

export async function createGuestPin(
  c: { apiKey: string; systemId: string; accessGroupId: string; fullName: string; startsAt: Date; endsAt: Date },
  fetchImpl: Fetch = fetch,
): Promise<{ acsUserId: string; code: string }> {
  const user = await call(fetchImpl, c.apiKey, "/acs/users/create", {
    full_name: c.fullName.slice(0, 80),
    acs_system_id: c.systemId,
    access_schedule: { starts_at: c.startsAt.toISOString(), ends_at: c.endsAt.toISOString() },
  });
  const acsUserId = (user.acs_user as { acs_user_id?: string } | undefined)?.acs_user_id;
  if (!acsUserId) throw new SeamError("Seam did not return the new guest user.");
  try {
    await call(fetchImpl, c.apiKey, "/acs/users/add_to_access_group", { acs_user_id: acsUserId, acs_access_group_id: c.accessGroupId });
    const cred = await call(fetchImpl, c.apiKey, "/acs/credentials/create", { acs_user_id: acsUserId, access_method: "code" });
    const code = (cred.acs_credential as { code?: string | null } | undefined)?.code;
    if (!code) throw new SeamError("The lock system has not produced a PIN yet. Try again in a minute.");
    return { acsUserId, code };
  } catch (err) {
    // Do not leave a half-made guest user behind (Salto may bill per user).
    await call(fetchImpl, c.apiKey, "/acs/users/delete", { acs_user_id: acsUserId }).catch(() => undefined);
    throw err;
  }
}

export async function deleteGuest(apiKey: string, acsUserId: string, fetchImpl: Fetch = fetch) {
  await call(fetchImpl, apiKey, "/acs/users/delete", { acs_user_id: acsUserId });
}
