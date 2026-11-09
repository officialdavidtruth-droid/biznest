/**
 * fetch() for calls that gateways only accept from a whitelisted server IP
 * (Korapay + Flutterwave payout/transfer APIs in live mode).
 *
 * Vercel functions have no fixed outbound IP, so those calls can never be
 * whitelisted from here directly. Set PAYOUT_PROXY_URL to an HTTP(S) forward
 * proxy that has a static IP (a small VPS running tinyproxy/squid, or a
 * static-IP proxy service), whitelist THAT IP in the Kora/Flutterwave
 * dashboards, and every payout call is routed through it. Unset = plain fetch
 * (sandbox mode, or hosts that already have a fixed IP).
 *
 * Only payout calls use this; checkout, verification and webhooks do not need it.
 */
type ProxyDispatcher = unknown;
let cached: { url: string; dispatcher: ProxyDispatcher } | null = null;

async function getDispatcher(proxyUrl: string): Promise<ProxyDispatcher> {
  if (cached?.url === proxyUrl) return cached.dispatcher;
  const { ProxyAgent } = await import("undici");
  const dispatcher = new ProxyAgent(proxyUrl);
  cached = { url: proxyUrl, dispatcher };
  return dispatcher;
}

export async function fixedIpFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const proxyUrl = process.env.PAYOUT_PROXY_URL?.trim();
  if (!proxyUrl) return fetch(input, init);
  try {
    const dispatcher = await getDispatcher(proxyUrl);
    // Must be undici's OWN fetch: handing the npm package's ProxyAgent to Node's built-in fetch
    // fails with UND_ERR_INVALID_ARG ("invalid onError method") when the two undici versions differ.
    const { fetch: undiciFetch } = await import("undici");
    return (await undiciFetch(input, { ...init, dispatcher } as never)) as unknown as Response;
  } catch (err) {
    // Node's "fetch failed" hides the real reason in err.cause. Surface it, plus the proxy host
    // (never the password), so a bad/unreachable proxy is obvious in the payout's error column.
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    const detail = [cause?.code, cause?.message ?? (err instanceof Error ? err.message : String(err))].filter(Boolean).join(": ");
    let host = "invalid proxy URL";
    try {
      host = new URL(proxyUrl).host;
    } catch {
      /* keep the placeholder */
    }
    throw new Error(`Payout proxy (${host}) failed: ${detail}`);
  }
}
