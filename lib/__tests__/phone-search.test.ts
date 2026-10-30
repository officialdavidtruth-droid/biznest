import { describe, expect, it } from "vitest";
import { phoneSearchTerms } from "@/lib/phone";

// Mimics Postgres `contains` against the forms a number can be stored in.
const stored = ["+2348031234567", "08031234567", "2348031234567", "8031234567"];
const matchesAny = (query: string) => {
  const terms = phoneSearchTerms(query);
  return stored.filter((s) => terms.some((t) => s.includes(t)));
};

describe("phoneSearchTerms", () => {
  it("finds a canonical +234 number from a local 0-prefixed partial", () => {
    expect(matchesAny("0803123")).toEqual(stored);
  });
  it("finds it from the +234 / 234 forms and a full number", () => {
    expect(matchesAny("+234803")).toEqual(stored);
    expect(matchesAny("08031234567")).toEqual(stored);
    expect(matchesAny("0803 123 4567")).toEqual(stored);
  });
  it("does not match a different number", () => {
    expect(matchesAny("0805999")).toEqual([]);
  });
  it("returns nothing for names, emails and too-short input", () => {
    expect(phoneSearchTerms("chika")).toEqual([]);
    expect(phoneSearchTerms("ada@x.com")).toEqual([]);
    expect(phoneSearchTerms("12")).toEqual([]);
    expect(phoneSearchTerms("")).toEqual([]);
  });
});
