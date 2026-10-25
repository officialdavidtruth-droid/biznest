import { headers } from "next/headers";

/** True when the request comes from the native BizNest Android app.
 *  The Capacitor shell appends "BizNestApp/<version>" to the WebView user
 *  agent (see mobile/capacitor.config.json -> android.appendUserAgent). */
export async function isAppRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes("BizNestApp");
}
