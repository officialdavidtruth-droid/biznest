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

// The platform-admin panel is served as a plain path (biznest.space/supaadmin)
// off the main site — no subdomain, no separate DNS record required.

// Hosts that are BizNest itself, not a vendor's custom domain.
function isPlatformHost(host: string): boolean {
  return (
    host === "biznest.space" ||
    host === "www.biznest.space" ||
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

  const slug = await resolveCustomDomain(host, req.nextUrl.origin);
  const url = req.nextUrl.clone();

  if (slug) {
    url.pathname = `/store/${slug}${url.pathname === "/" ? "" : url.pathname}`;
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
      // Non-admins hitting /admin or /supaadmin just get bounced to the
      // homepage — no subdomain special-casing needed anymore.
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  return rewritten ? NextResponse.rewrite(url) : NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
