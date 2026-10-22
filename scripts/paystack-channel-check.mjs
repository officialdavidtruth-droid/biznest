// Tells you in about two minutes whether missing payment methods are caused by
// your code or by your Paystack account.
//
//   PAYSTACK_SECRET_KEY=sk_live_xxx node scripts/paystack-channel-check.mjs [OLD_SUBACCOUNT_CODE]
//
// It creates up to three UNPAID NGN 100 checkout sessions (nothing is charged
// until someone pays) and prints their links. Open each in a browser and note
// which payment methods appear:
//   A) no `channels`            -> what your app sends today
//   B) every NGN channel listed -> if B still lacks Transfer/Bank, the cause is
//                                  the Paystack account, not your code
//   C) (optional) with an old subaccount code -> if C shows MORE methods than
//                                  A, the subaccount was changing what you saw
const key = process.env.PAYSTACK_SECRET_KEY;
if (!key) { console.error("Set PAYSTACK_SECRET_KEY first."); process.exit(1); }
const sub = process.argv[2];

async function init(label, extra) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "channel-check@example.com", amount: 10000, currency: "NGN", reference: `chk-${label}-${Date.now()}`, ...extra }),
  });
  const json = await res.json();
  console.log(`\n[${label}] ${json.status ? "OK" : "FAILED: " + json.message}`);
  if (json.status) console.log(json.data.authorization_url);
}

await init("A-default", {});
await init("B-all-channels", { channels: ["card", "bank", "ussd", "qr", "bank_transfer", "apple_pay"] });
if (sub) await init("C-with-subaccount", { subaccount: sub, bearer: "account" });
