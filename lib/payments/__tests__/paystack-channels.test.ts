import { describe, expect, it } from "vitest";
import { parsePaystackChannels, NGN_ALL_CHANNELS } from "@/lib/payments/paystack-channels";

describe("parsePaystackChannels", () => {
  it("returns undefined when unset so Paystack's dashboard settings still decide", () => {
    expect(parsePaystackChannels(undefined)).toBeUndefined();
    expect(parsePaystackChannels("")).toBeUndefined();
    expect(parsePaystackChannels("  ,  ")).toBeUndefined();
  });
  it("parses, trims, lowercases and de-duplicates", () => {
    expect(parsePaystackChannels(" Card, bank_transfer ,USSD,card ")).toEqual(["card", "bank_transfer", "ussd"]);
  });
  it("drops unknown channels instead of sending them to Paystack", () => {
    expect(parsePaystackChannels("card,paypal,bitcoin")).toEqual(["card"]);
    expect(parsePaystackChannels("paypal")).toBeUndefined();
  });
  it("NGN_ALL_CHANNELS includes both bank transfer and pay-with-bank", () => {
    expect(NGN_ALL_CHANNELS).toEqual(expect.arrayContaining(["card", "ussd", "bank", "bank_transfer"]));
  });
});
