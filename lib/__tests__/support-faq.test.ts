import { describe, expect, it } from "vitest";
import { answerQuestion, FAQ, SUGGESTIONS } from "@/lib/support-faq";

describe("support help bot: answerQuestion", () => {
  it("answers a common how-to question", () => {
    const r = answerQuestion("How do I add a product?");
    expect(r.reply).toContain("Add product");
    expect(r.handoff).toBeFalsy();
  });

  it("matches words that end in a full stop (regression: 'payouts.' never matched 'payout')", () => {
    const withDot = answerQuestion("Where are my payouts.");
    const withoutDot = answerQuestion("Where are my payouts");
    expect(withDot.reply).toBe(withoutDot.reply);
    expect(withDot.reply).toContain("Payments");
  });

  it("keeps inner dots so domains still match", () => {
    const r = answerQuestion("connect my own domain yourstore.com");
    expect(r.reply).toContain("custom domain");
  });

  it("understands synonyms (cashier -> staff)", () => {
    const r = answerQuestion("I want to invite a cashier");
    expect(r.reply).toContain("Open Staff");
  });

  it("flags money problems for a human handoff", () => {
    const r = answerQuestion("money not received in my bank");
    expect(r.handoff).toBe(true);
  });

  it("replies to greetings and thanks without searching topics", () => {
    expect(answerQuestion("hi").reply).toContain("Ask me how to do anything");
    expect(answerQuestion("thanks a lot").reply).toContain("You're welcome");
  });

  it("falls back to a handoff with suggestions when nothing matches", () => {
    const r = answerQuestion("xyzzy qwerty");
    expect(r.reply).toContain("not sure");
    expect(r.handoff).toBe(true);
    expect(r.chips?.length).toBeGreaterThan(0);
  });

  it("explains the current page for 'what is this page'", () => {
    const r = answerQuestion("what is this page", "/orders");
    expect(r.reply.startsWith("Orders:")).toBe(true);
  });
});

describe("support help bot: content integrity", () => {
  it("has unique FAQ ids", () => {
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
  });

  it("every suggestion chip gets a real answer, not the fallback", () => {
    for (const s of SUGGESTIONS) {
      expect(answerQuestion(s).reply).not.toContain("not sure I have an answer");
    }
  });
});
