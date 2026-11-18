import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAccountProfile } from "@/lib/customer-profile-store";
import { GOOGLE_CALLBACK_URL, PLATFORM_ORIGIN, allowedStoreOrigins, signToken, verifyToken } from "@/lib/store-google";

/** Google sends the shopper back here (the one URL registered with Google). Finds or creates the store's customer account. */
export async function GET(req: NextRequest) {
  const state = verifyToken<{ slug: string; origin: string; returnTo: string }>("store-google-state", req.nextUrl.searchParams.get("state"));
  if (!state) return NextResponse.redirect(new URL("/login?error=GoogleFailed", PLATFORM_ORIGIN));

  const back = (error: string) => NextResponse.redirect(new URL(`/login?store=${encodeURIComponent(state.slug)}&error=${error}`, state.origin));
  const code = req.nextUrl.searchParams.get("code");
  if (!code || req.nextUrl.searchParams.get("error")) return back("GoogleFailed");

  const store = await prisma.store.findUnique({
    where: { slug: state.slug },
    select: { id: true, status: true, customDomain: true, customDomainStatus: true },
  });
  if (!store || store.status !== "ACTIVE" || !allowedStoreOrigins(store).includes(state.origin)) return back("GoogleFailed");

  // Exchange the code, then read who signed in.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!tokenRes?.ok) return back("GoogleFailed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return back("GoogleFailed");

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } }).catch(() => null);
  if (!infoRes?.ok) return back("GoogleFailed");
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
  const email = info.email?.trim().toLowerCase();
  if (!email || !info.email_verified) return back("GoogleFailed");

  // This store's own account for that email (independent of the same email on other stores or on the BizNest app).
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, customerScopeStoreId: store.id, role: "CUSTOMER" },
    select: { id: true, isBanned: true, emailVerified: true },
  });
  if (user?.isBanned) return back("AccessDenied");

  if (!user) {
    const name = (info.name ?? email.split("@")[0]).slice(0, 80);
    user = await prisma.user.create({
      data: { name, email, role: "CUSTOMER", customerScopeStoreId: store.id, emailVerified: new Date() },
      select: { id: true, isBanned: true, emailVerified: true },
    });
    await prisma.storeCustomer.create({ data: { userId: user.id, storeId: store.id } });
    await ensureAccountProfile(prisma, { userId: user.id, storeId: store.id, name, email, phone: null, emailVerified: true });
  } else {
    if (!user.emailVerified) await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    const member = await prisma.storeCustomer.findFirst({ where: { userId: user.id, storeId: store.id }, select: { id: true } });
    if (!member) await prisma.storeCustomer.create({ data: { userId: user.id, storeId: store.id } });
  }

  // Hand the shopper back to the host they started on; that host sets its own cookie in /finish.
  const handoff = signToken("store-google-handoff", { userId: user.id, storeId: store.id, returnTo: state.returnTo, origin: state.origin }, 60 * 1000);
  return NextResponse.redirect(new URL(`/api/store-google/finish?t=${encodeURIComponent(handoff)}`, state.origin));
}

export const dynamic = "force-dynamic";
