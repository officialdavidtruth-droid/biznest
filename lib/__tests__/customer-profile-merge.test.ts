import { describe, expect, it } from "vitest";
import { mergeProfileUpdate, pickProfile, type ProfileLike } from "@/lib/customer-profile-merge";

const p = (id: string, extra: Partial<ProfileLike> = {}): ProfileLike => ({ id, name: "Ada Obi", email: null, phone: null, userId: null, ...extra });
const none = { name: null, email: null, phone: null };

describe("pickProfile", () => {
  const a = p("A", { phone: "+2348031234567", email: "a@x.com", updatedAt: new Date("2026-01-01") });
  const b = p("B", { phone: "+2348039999999", email: "b@x.com", updatedAt: new Date("2026-02-01") });

  it("prefers a profile matching both phone and email", () => {
    expect(pickProfile([a, b], { ...none, phone: "0803 123 4567", email: "A@x.com" })?.id).toBe("A");
  });
  it("prefers the phone match when phone and email belong to different people", () => {
    expect(pickProfile([a, b], { ...none, phone: "08031234567", email: "b@x.com" })?.id).toBe("A");
  });
  it("falls back to the email match, then null", () => {
    expect(pickProfile([a, b], { ...none, email: "b@x.com" })?.id).toBe("B");
    expect(pickProfile([a, b], { ...none, phone: "08050000000", email: "c@x.com" })).toBeNull();
  });
  it("breaks ties by most recently updated", () => {
    const a2 = p("A2", { phone: "+2348031234567", updatedAt: new Date("2026-03-01") });
    expect(pickProfile([a, a2], { ...none, phone: "08031234567" })?.id).toBe("A2");
  });
});

describe("mergeProfileUpdate", () => {
  it("never overwrites existing name, email or phone with different values", () => {
    const existing = p("A", { name: "Ada Obi", email: "ada@x.com", phone: "+2348031234567" });
    const r = mergeProfileUpdate(existing, { name: "Adaeze", email: "other@x.com", phone: "08099999999" }, null);
    expect(r.data).toEqual({});
    expect(r.kept.sort()).toEqual(["email", "name", "phone"]);
  });
  it("fills blanks", () => {
    const r = mergeProfileUpdate(p("A"), { name: "Ada Obi", email: "ada@x.com", phone: "+2348031234567" }, null);
    expect(r.data).toEqual({ email: "ada@x.com", phone: "+2348031234567" });
  });
  it("replaces a placeholder name with a real one", () => {
    const existing = p("A", { name: "+2348031234567", phone: "+2348031234567" });
    expect(mergeProfileUpdate(existing, { ...none, name: "Ada Obi" }, null).data).toEqual({ name: "Ada Obi" });
    expect(mergeProfileUpdate(p("A", { name: "Customer" }), { ...none, name: "Ada Obi" }, null).data).toEqual({ name: "Ada Obi" });
  });
  it("does not treat the same phone in another format as a conflict", () => {
    const r = mergeProfileUpdate(p("A", { phone: "+2348031234567" }), { ...none, phone: "0803 123 4567" }, null);
    expect(r.data).toEqual({});
    expect(r.kept).toEqual([]);
  });
  it("links a login account only when its email is the profile's and it is free", () => {
    const user = { id: "u1", linkedToOtherProfile: false };
    // profile has a different email (matched by phone) -> do not attach the other person's account
    expect(mergeProfileUpdate(p("A", { email: "ada@x.com" }), { ...none, email: "b@x.com" }, user).data.userId).toBeUndefined();
    // profile email matches -> link
    expect(mergeProfileUpdate(p("A", { email: "b@x.com" }), { ...none, email: "b@x.com" }, user).data.userId).toBe("u1");
    // blank email filled from the till and the account owns it -> link
    expect(mergeProfileUpdate(p("A"), { ...none, email: "b@x.com" }, user).data.userId).toBe("u1");
  });
  it("never steals an account already linked to another profile or replaces an existing link", () => {
    expect(mergeProfileUpdate(p("A", { email: "b@x.com" }), { ...none, email: "b@x.com" }, { id: "u1", linkedToOtherProfile: true }).data.userId).toBeUndefined();
    expect(mergeProfileUpdate(p("A", { email: "b@x.com", userId: "u0" }), { ...none, email: "b@x.com" }, { id: "u1", linkedToOtherProfile: false }).data.userId).toBeUndefined();
  });
});
