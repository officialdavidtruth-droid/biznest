import { beforeAll, describe, expect, it } from "vitest";
import { challengeFor, isChallenge, signHandoff, verifyHandoff } from "@/lib/desktop-handoff";

const verifier = "v".repeat(43);
beforeAll(() => { process.env.AUTH_SECRET = "test-secret"; });

describe("desktop sign-in handoff", () => {
  it("accepts a fresh code with the matching verifier", () => {
    const code = signHandoff("user1", challengeFor(verifier));
    expect(verifyHandoff(code, verifier)).toBe("user1");
  });
  it("rejects the wrong verifier", () => {
    const code = signHandoff("user1", challengeFor(verifier));
    expect(verifyHandoff(code, "w".repeat(43))).toBeNull();
  });
  it("rejects an expired code", () => {
    const code = signHandoff("user1", challengeFor(verifier), Date.now() - 5 * 60 * 1000);
    expect(verifyHandoff(code, verifier)).toBeNull();
  });
  it("rejects a tampered code", () => {
    const code = signHandoff("user1", challengeFor(verifier));
    const [body, sig] = code.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin", c: challengeFor(verifier), e: Date.now() + 1e6 })).toString("base64url");
    expect(verifyHandoff(`${forged}.${sig}`, verifier)).toBeNull();
    expect(verifyHandoff(`${body}.x`, verifier)).toBeNull();
  });
  it("validates challenge shape", () => {
    expect(isChallenge(challengeFor(verifier))).toBe(true);
    expect(isChallenge("short")).toBe(false);
  });
});
