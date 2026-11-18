import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { GOOGLE_CALLBACK_URL, PLATFORM_ORIGIN, allowedStoreOrigins, signToken } from "@/lib/store-google";

/** GET /api/store-google/start?store=<slug>&returnTo=/path — begins Google sign-in for a storefront customer. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("store") ?? "";
  const returnTo = safeRedirectPath(req.nextUrl.searchParams.get("returnTo"), `/store/${slug}/account`);
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const origin = `https://${host}`;

  const store = slug
    ? await prisma.store.findUnique({ where: { slug }, select: { id: true, status: true, customDomain: true, customDomainStatus: true } })
    : null;
  if (!store || store.status !== "ACTIVE" || !process.env.GOOGLE_CLIENT_ID || !allowedStoreOrigins(store).includes(origin)) {
    return NextResponse.redirect(new URL(`/login?store=${encodeURIComponent(slug)}&error=GoogleUnavailable`, origin));
  }

  const state = signToken("store-google-state", { slug, origin, returnTo, n: randomBytes(8).toString("hex") }, 10 * 60 * 1000);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_CALLBACK_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(url);
}

export const dynamic = "force-dynamic";
void PLATFORM_ORIGIN;
