import { describe, expect, it, vi } from "vitest";
import { createGuestPin, deleteGuest, listAccessGroups, listAcsSystems, SeamError } from "@/lib/locks/seam";

type Step = { status?: number; body: unknown };
const seq = (steps: Step[]) => {
  const f = vi.fn(async () => { const s = steps.shift() ?? { body: {} }; return new Response(JSON.stringify(s.body), { status: s.status ?? 200 }); });
  return f as unknown as typeof fetch & ReturnType<typeof vi.fn>;
};
const call = (f: ReturnType<typeof vi.fn>, i: number) => { const [url, init] = f.mock.calls[i] as [string, RequestInit]; return { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).authorization }; };
const stay = { apiKey: "k", systemId: "sys", accessGroupId: "grp", fullName: "Ada Obi", startsAt: new Date("2026-11-14T12:00:00Z"), endsAt: new Date("2026-11-16T10:00:00Z") };

describe("seam client", () => {
  it("creates user, joins the room's group, and returns the Salto-generated PIN", async () => {
    const f = seq([{ body: { acs_user: { acs_user_id: "u1" } } }, { body: { ok: true } }, { body: { acs_credential: { code: "482913" } } }]);
    expect(await createGuestPin(stay, f)).toEqual({ acsUserId: "u1", code: "482913" });
    expect(call(f, 0)).toEqual({ url: "https://connect.getseam.com/acs/users/create", auth: "Bearer k", body: { full_name: "Ada Obi", acs_system_id: "sys", access_schedule: { starts_at: "2026-11-14T12:00:00.000Z", ends_at: "2026-11-16T10:00:00.000Z" } } });
    expect(call(f, 1).body).toEqual({ acs_user_id: "u1", acs_access_group_id: "grp" });
    expect(call(f, 2)).toMatchObject({ url: "https://connect.getseam.com/acs/credentials/create", body: { acs_user_id: "u1", access_method: "code" } });
  });
  it("removes the half-made user if the PIN cannot be created", async () => {
    const f = seq([{ body: { acs_user: { acs_user_id: "u1" } } }, { body: { ok: true } }, { status: 400, body: { error: { message: "no entrances" } } }, { body: {} }]);
    await expect(createGuestPin(stay, f)).rejects.toThrow("no entrances");
    expect(call(f, 3)).toMatchObject({ url: "https://connect.getseam.com/acs/users/delete", body: { acs_user_id: "u1" } });
  });
  it("refuses an empty PIN", async () => {
    const f = seq([{ body: { acs_user: { acs_user_id: "u1" } } }, { body: { ok: true } }, { body: { acs_credential: { code: null } } }, { body: {} }]);
    await expect(createGuestPin(stay, f)).rejects.toBeInstanceOf(SeamError);
  });
  it("lists systems and groups, and deletes a guest", async () => {
    expect(await listAcsSystems("k", seq([{ body: { acs_systems: [{ acs_system_id: "s1", name: "Lusso Salto", external_type: "salto_ks_site" }] } }]))).toEqual([{ id: "s1", name: "Lusso Salto", type: "salto_ks_site" }]);
    expect(await listAccessGroups("k", "s1", seq([{ body: { acs_access_groups: [{ acs_access_group_id: "g1", name: "Room 201" }] } }]))).toEqual([{ id: "g1", name: "Room 201" }]);
    const f = seq([{ body: {} }]);
    await deleteGuest("k", "u1", f);
    expect(call(f, 0).url).toBe("https://connect.getseam.com/acs/users/delete");
  });
});
