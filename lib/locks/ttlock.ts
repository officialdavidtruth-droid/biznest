/**
 * Minimal TTLock Open Platform client (https://euopen.ttlock.com/doc).
 * Passcodes are created through the lock's WiFi lock / gateway (addType 2), so the lock must be
 * reachable by a gateway. All calls are form-encoded POSTs; TTLock reports failure as errcode != 0 with HTTP 200.
 */
import crypto from "crypto";

export const TTLOCK_BASE = "https://api.sciener.com";

export class TtlockError extends Error {
  constructor(message: string, public code?: number) { super(message); }
}

type Fetch = typeof fetch;

async function post(fetchImpl: Fetch, path: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetchImpl(`${TTLOCK_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new TtlockError(`TTLock returned HTTP ${res.status}.`);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) throw new TtlockError("TTLock sent an unreadable reply.");
  const code = typeof json.errcode === "number" ? json.errcode : 0;
  if (code !== 0) throw new TtlockError(String(json.errmsg || json.description || `TTLock error ${code}`).slice(0, 200), code);
  return json;
}

export const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

export async function getToken(c: { clientId: string; clientSecret: string; username: string; passwordMd5: string }, fetchImpl: Fetch = fetch) {
  const j = await post(fetchImpl, "/oauth2/token", { client_id: c.clientId, client_secret: c.clientSecret, username: c.username, password: c.passwordMd5 });
  if (typeof j.access_token !== "string") throw new TtlockError("TTLock did not return a token. Check the developer ID, secret, username and password.");
  return { accessToken: j.access_token, expiresInSec: typeof j.expires_in === "number" ? j.expires_in : 7_776_000 };
}

export async function listLocks(c: { clientId: string; accessToken: string }, fetchImpl: Fetch = fetch) {
  const j = await post(fetchImpl, "/v3/lock/list", { clientId: c.clientId, accessToken: c.accessToken, pageNo: 1, pageSize: 200, date: Date.now() });
  const list = Array.isArray(j.list) ? (j.list as Array<Record<string, unknown>>) : [];
  return list.map((l) => ({
    lockId: String(l.lockId),
    name: String(l.lockAlias || l.lockName || l.lockId),
    hasGateway: l.hasGateway === 1,
    battery: typeof l.electricQuantity === "number" ? l.electricQuantity : null,
  }));
}

/** 6-digit numeric code that never starts with 0 and is not a trivial run. */
export function generatePasscode(randomInt: (min: number, max: number) => number = crypto.randomInt): string {
  for (;;) {
    const code = String(randomInt(100_000, 1_000_000));
    if (!/^(\d)\1+$/.test(code) && code !== "123456" && code !== "654321") return code;
  }
}

export async function addPasscode(c: { clientId: string; accessToken: string; lockId: string; passcode: string; name: string; startMs: number; endMs: number }, fetchImpl: Fetch = fetch) {
  const j = await post(fetchImpl, "/v3/keyboardPwd/add", {
    clientId: c.clientId, accessToken: c.accessToken, lockId: c.lockId, keyboardPwd: c.passcode, keyboardPwdName: c.name.slice(0, 40),
    startDate: c.startMs, endDate: c.endMs, addType: 2, date: Date.now(),
  });
  if (j.keyboardPwdId === undefined) throw new TtlockError("TTLock did not confirm the passcode.");
  return String(j.keyboardPwdId);
}

export async function deletePasscode(c: { clientId: string; accessToken: string; lockId: string; passcodeId: string }, fetchImpl: Fetch = fetch) {
  await post(fetchImpl, "/v3/keyboardPwd/delete", { clientId: c.clientId, accessToken: c.accessToken, lockId: c.lockId, keyboardPwdId: c.passcodeId, deleteType: 2, date: Date.now() });
}
