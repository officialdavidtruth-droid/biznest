import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth instance, built only from the Prisma-free base config.
// Do NOT import { auth } from "@/lib/auth" here — that pulls in Prisma via
// the adapter/Credentials provider, and middleware always runs on the Edge
// Runtime, which cannot run Prisma Client. See lib/auth.config.ts for the
// full explanation; this was the exact cause of a sitewide sign-in outage.
const { auth } = NextAuth(authConfig);

// Routes that require an authenticated session at all.
const PROTECTED_PREFIXES = ["/onboarding", "/dashboard", "/admin", "/supaadmin", "/account", "/orders"];

// Store admin routes: /store/[slug]/admin/** — ownership is verified inside
// the route handlers/layout (needs a DB lookup middleware can't cheaply do
// on every request), but middleware still blocks unauthenticated access.
const STORE_ADMIN_PATTERN = /^\/store\/[^/]+\/admin/;

// Platform admin routes require PLATFORM_ADMIN or SUPPORT_MODERATOR role.
const PLATFORM_ADMIN_PATTERN = /^\/(admin|supaadmin)/;

// The platform-admin panel (/supaadmin/**) is served on its own subdomain
// rather than as a path off the main site.
const SUPAADMIN_HOST = "supaadmin.biznest.space";

function isSupaAdminHost(host: string): boolean {
  // ".startsWith" (not "===") so "supaadmin.localhost:3000" also works for
  // local testing — hostname strips the port, so this still matches.
  return host === SUPAADMIN_HOST || host.startsWith("supaadmin.localhost");
}

// Hosts that are BizNest itself, not a vendor's custom domain.
function isPlatformHost(host: string): boolean {
  return (
    host === "biznest.space" ||
    host === "www.biznest.space" ||
    host === SUPAADMIN_HOST ||
    host.startsWith("supaadmin.localhost") ||
    host === "localhost" ||
    host.endsWith(".vercel.app")
  );
}

/**
 * Resolves a custom domain (e.g. mystore.com, an Enterprise/Business Mogul
 * feature) to its store slug by calling app/api/resolve-domain (Node.js
 * runtime, so it can use Prisma safely — middleware itself cannot).
 */
async function resolveCustomDomain(host: string, origin: string): Promise<string | null> {
  if (isPlatformHost(host)) return null;
  try {
    const res = await fetch(new URL(`/api/resolve-domain?host=${host}`, origin));
    if (!res.ok) return null;
    const { slug } = (await res.json()) as { slug: string | null };
    return slug;
  } catch {
    // Resolver unreachable — fail open to "not a known custom domain"
    // rather than break the request entirely.
    return null;
  }
}

export default auth(async (req) => {
  const host = req.nextUrl.hostname.toLowerCase();

  // Legacy path-based links (biznest.space/supaadmin/...) now live on their
  // own subdomain — send them there instead of rendering in place. 308
  // since this is a permanent move, and it preserves the request method.
  if (isPlatformHost(host) && !isSupaAdminHost(host) && req.nextUrl.pathname.startsWith("/supaadmin")) {
    const target = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, `https://${SUPAADMIN_HOST}`);
    return NextResponse.redirect(target, 308);
  }

  const slug = await resolveCustomDomain(host, req.nextUrl.origin);
  const url = req.nextUrl.clone();

  if (slug) {
    url.pathname = `/store/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  } else if (isSupaAdminHost(host) && url.pathname === "/") {
    // Bare visits to the subdomain (supaadmin.biznest.space) land on the
    // dashboard. Every other path — including /login and the /supaadmin/**
    // links already used throughout the admin UI — is left untouched, so
    // nothing else needs to change.
    url.pathname = "/supaadmin";
  }

  const { pathname } = url;
  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) || STORE_ADMIN_PATTERN.test(pathname);

  const rewritten = slug !== null || pathname !== req.nextUrl.pathname;

  if (!isProtected) {
    return rewritten ? NextResponse.rewrite(url) : NextResponse.next();
  }

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Absolute URL, not just `pathname` — a bare path like "/supaadmin" has
    // no host in it, so NextAuth's redirect callback would resolve it
    // against AUTH_URL (www.biznest.space) and lose the subdomain entirely.
    loginUrl.searchParams.set("callbackUrl", `${req.nextUrl.origin}${pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  if (PLATFORM_ADMIN_PATTERN.test(pathname)) {
    const role = req.auth.user.role;
    if (role !== "PLATFORM_ADMIN" && role !== "SUPPORT_MODERATOR") {
      // On the supaadmin subdomain, "/" itself gets rewritten right back
      // into "/supaadmin" (see above) — redirecting a non-admin to "/" here
      // would just bounce them into this exact same check forever
      // (ERR_TOO_MANY_REDIRECTS). Send them to the real homepage on the
      // main site instead, since they have no reason to be on this
      // subdomain at all.
      const target = isSupaAdminHost(host) ? `https://www.biznest.space/` : new URL("/", req.nextUrl.origin);
      return NextResponse.redirect(target);
    }
  }

  return rewritten ? NextResponse.rewrite(url) : NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
