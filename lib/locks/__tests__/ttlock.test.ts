import { describe, expect, it, vi } from "vitest";
import { addPasscode, deletePasscode, generatePasscode, getToken, listLocks, md5, TtlockError } from "@/lib/locks/ttlock";

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const sent = (f: typeof fetch) => { const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]; return { url, form: new URLSearchParams(String(init.body)), init }; };

describe("ttlock client", () => {
  it("md5 matches the 32-char lowercase form TTLock expects", () => {
    expect(md5("secret")).toBe("5ebe2294ecd0e0f08eab7690d2a6ee69");
  });
  it("requests a token with the form fields TTLock documents", async () => {
    const f = reply({ access_token: "tok", expires_in: 100 });
    const t = await getToken({ clientId: "id", clientSecret: "sec", username: "u", passwordMd5: "abc" }, f);
    expect(t).toEqual({ accessToken: "tok", expiresInSec: 100 });
    const s = sent(f);
    expect(s.url).toBe("https://api.sciener.com/oauth2/token");
    expect(s.init.method).toBe("POST");
    expect(Object.fromEntries(s.form)).toEqual({ client_id: "id", client_secret: "sec", username: "u", password: "abc" });
  });
  it("creates a gateway passcode and returns its id", async () => {
    const f = reply({ keyboardPwdId: 24242 });
    const id = await addPasscode({ clientId: "id", accessToken: "tok", lockId: "9", passcode: "482913", name: "Room 4", startMs: 1, endMs: 2 }, f);
    expect(id).toBe("24242");
    const { url, form } = sent(f);
    expect(url).toBe("https://api.sciener.com/v3/keyboardPwd/add");
    expect(form.get("addType")).toBe("2");
    expect(form.get("keyboardPwd")).toBe("482913");
    expect(form.get("lockId")).toBe("9");
  });
  it("deletes through the gateway", async () => {
    const f = reply({ errcode: 0 });
    await deletePasscode({ clientId: "id", accessToken: "tok", lockId: "9", passcodeId: "24242" }, f);
    const { url, form } = sent(f);
    expect(url).toBe("https://api.sciener.com/v3/keyboardPwd/delete");
    expect(form.get("deleteType")).toBe("2");
  });
  it("turns an errcode reply into an error", async () => {
    await expect(addPasscode({ clientId: "id", accessToken: "t", lockId: "9", passcode: "482913", name: "x", startMs: 1, endMs: 2 }, reply({ errcode: -3003, errmsg: "lock is offline" }))).rejects.toThrow("lock is offline");
    await expect(listLocks({ clientId: "id", accessToken: "t" }, reply({}, 500))).rejects.toBeInstanceOf(TtlockError);
  });
  it("lists locks", async () => {
    const locks = await listLocks({ clientId: "id", accessToken: "t" }, reply({ list: [{ lockId: 5, lockAlias: "Room 201", hasGateway: 1, electricQuantity: 80 }] }));
    expect(locks).toEqual([{ lockId: "5", name: "Room 201", hasGateway: true, battery: 80 }]);
  });
  it("passcodes are 6 digits and skip trivial codes", () => {
    const seq = [111111, 123456, 482913];
    let i = 0;
    expect(generatePasscode(() => seq[i++])).toBe("482913");
    expect(generatePasscode()).toMatch(/^[1-9]\d{5}$/);
  });
});
