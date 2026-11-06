export type CheckStatus = "ok" | "warn" | "fail" | "manual";
export type ReadinessCheck = { id: string; label: string; status: CheckStatus; detail: string; fix?: string };

export type ReadinessInput = {
  secretKey?: string | null;
  publicKey?: string | null;        // NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (what the browser uses)
  serverPublicKey?: string | null;  // PAYSTACK_PUBLIC_KEY, if set
  appUrl: string;
  activeGateway: string;
  billingGateway: string;
  /** Result of calling Paystack's balance endpoint with the secret key; null if not attempted. */
  balance: { ok: boolean; message: string; kobo?: number } | null;
};

const mode = (key?: string | null): "live" | "test" | "unknown" | "missing" => {
  if (!key) return "missing";
  if (/^(sk|pk)_live_/.test(key)) return "live";
  if (/^(sk|pk)_test_/.test(key)) return "test";
  return "unknown";
};

export const webhookUrl = (appUrl: string) => `${appUrl.replace(/\/$/, "")}/api/payments/paystack/webhook`;

/** Turns the current configuration into a go-live checklist. Pure, so it is easy to test. */
export function evaluatePaystackReadiness(i: ReadinessInput): { checks: ReadinessCheck[]; live: boolean; blockers: number } {
  const checks: ReadinessCheck[] = [];
  const sm = mode(i.secretKey);
  const pm = mode(i.publicKey);

  checks.push(
    sm === "missing" ? { id: "secret", label: "Secret key", status: "fail", detail: "PAYSTACK_SECRET_KEY is not set.", fix: "Add your sk_live_ key in Vercel, then redeploy." }
    : sm === "unknown" ? { id: "secret", label: "Secret key", status: "fail", detail: "PAYSTACK_SECRET_KEY doesn't look like a Paystack key (expected sk_live_… or sk_test_…).", fix: "Copy it again from Paystack, Settings, API Keys & Webhooks. Check for spaces." }
    : sm === "test" ? { id: "secret", label: "Secret key", status: "warn", detail: "Test key. Cards are not really charged and no money moves.", fix: "When Paystack approves your account, replace it with the sk_live_ key." }
    : { id: "secret", label: "Secret key", status: "ok", detail: "Live key is set." },
  );

  checks.push(
    pm === "missing" ? { id: "public", label: "Public key", status: "fail", detail: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set, so the in-page checkout can't open.", fix: "Add your pk_live_ key as NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (and PAYSTACK_PUBLIC_KEY), then redeploy. It is baked in at build time." }
    : pm === "unknown" ? { id: "public", label: "Public key", status: "fail", detail: "The public key doesn't look like a Paystack key (expected pk_live_… or pk_test_…).", fix: "Copy it again from Paystack." }
    : sm !== "missing" && sm !== "unknown" && pm !== sm ? { id: "public", label: "Public key", status: "fail", detail: `Secret key is ${sm} but public key is ${pm}. Checkout would fail or charge on the wrong account.`, fix: "Use the matching pair: both live or both test. Redeploy after changing." }
    : { id: "public", label: "Public key", status: "ok", detail: `${pm === "live" ? "Live" : "Test"} key matches the secret key.` },
  );

  if (i.serverPublicKey && i.publicKey && i.serverPublicKey !== i.publicKey) {
    checks.push({ id: "public-pair", label: "Public key copies", status: "warn", detail: "PAYSTACK_PUBLIC_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY are different.", fix: "Set both to the same value." });
  }

  if (!i.balance) {
    checks.push({ id: "api", label: "Paystack connection", status: "warn", detail: "Not checked." });
  } else if (!i.balance.ok) {
    checks.push({ id: "api", label: "Paystack connection", status: "fail", detail: `Paystack rejected the key: ${i.balance.message}`, fix: "Check the secret key, and that API IP whitelisting is off in Paystack (Vercel's IPs change)." });
  } else {
    const naira = (i.balance.kobo ?? 0) / 100;
    checks.push({ id: "api", label: "Paystack connection", status: "ok", detail: `Connected. Available balance ₦${naira.toLocaleString("en-NG", { maximumFractionDigits: 2 })}.` });
    if (sm === "live" && naira < 1) {
      checks.push({ id: "balance", label: "Payout balance", status: "warn", detail: "The balance is empty. Vendor payouts are sent from it, so they wait until Paystack settles your first sales.", fix: "Expect payouts to start after the first settlement. You can also top up the balance from the Paystack dashboard." });
    }
  }

  let host = "";
  try { host = new URL(i.appUrl).hostname; } catch { /* handled below */ }
  checks.push(
    !host || host === "localhost" || host.endsWith(".vercel.app") || !i.appUrl.startsWith("https://")
      ? { id: "url", label: "Site address", status: "fail", detail: `NEXT_PUBLIC_APP_URL is ${i.appUrl || "empty"}. Paystack sends customers and webhooks back to this address.`, fix: "Set NEXT_PUBLIC_APP_URL to https://www.biznest.space and redeploy." }
      : { id: "url", label: "Site address", status: "ok", detail: i.appUrl },
  );

  checks.push(
    i.activeGateway === "PAYSTACK" ? { id: "active", label: "Store checkout gateway", status: "ok", detail: "Store checkout uses Paystack." }
    : { id: "active", label: "Store checkout gateway", status: "warn", detail: `Store checkout currently uses ${i.activeGateway}.`, fix: "Switch it to Paystack in SupaAdmin, Settings, when you go live." },
  );
  checks.push(
    i.billingGateway === "PAYSTACK" ? { id: "billing", label: "Plan, app, ads and wallet payments", status: "ok", detail: "These use Paystack." }
    : { id: "billing", label: "Plan, app, ads and wallet payments", status: "warn", detail: `These use ${i.billingGateway}.`, fix: "Set BILLING_GATEWAY=PAYSTACK in Vercel and redeploy to move them to Paystack." },
  );

  const manual = (id: string, label: string, detail: string): ReadinessCheck => ({ id, label, status: "manual", detail });
  checks.push(
    manual("webhook", "Webhook saved in Paystack", `Settings, API Keys & Webhooks, Live Webhook URL = ${webhookUrl(i.appUrl)}. Then use "Send test" there and confirm it shows 200.`),
    manual("transfers", "Transfers enabled", "Paystack dashboard, Transfers must be switched on for your account. Vendor payouts use it."),
    manual("otp", "Transfer OTP switched off", "Settings, Preferences, turn off \"Confirm transfers before sending\". If it stays on, every payout stops at an OTP step and never completes."),
    manual("whitelist", "API IP whitelist off", "Settings, API Keys & Webhooks. Leave IP whitelisting empty: Vercel has no fixed IP."),
    manual("smoke", "Real ₦100 test", "Pay ₦100 on your own store with a real card. Confirm the order turns paid, the webhook shows 200 in Paystack, and the payout arrives in the vendor's bank."),
  );

  const blockers = checks.filter((c) => c.status === "fail").length;
  return { checks, live: sm === "live" && pm === "live", blockers };
}
