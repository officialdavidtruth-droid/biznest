import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";

// Edge-safe auth instance, built only from the Prisma-free base config.
// Do NOT import { auth } from "@/lib/auth" here — that pulls in Prisma via
// the adapter/Credentials provider, and middleware always runs on the Edge
// Runtime, which cannot run Prisma Client. See lib/auth.config.ts for the
// full explanation; this was the exact cause of a sitewide sign-in outage.
const { auth } = NextAuth(authConfig);

// Routes that require an authenticated *user* session (NextAuth). Deliberately
// excludes /supaadmin — that's gated by its own PIN cookie below, completely
// independent of user accounts. See lib/admin-pin-auth.ts for why.
const PROTECTED_PREFIXES = ["/onboarding", "/dashboard", "/admin", "/account", "/orders", "/disputes"];

// Store admin routes: /store/[slug]/admin/** — ownership is verified inside
// the route handlers/layout (needs a DB lookup middleware can't cheaply do
// on every request), but middleware still blocks unauthenticated access.
const STORE_ADMIN_PATTERN = /^\/store\/[^/]+\/admin/;

// Matches the customer-facing /store/[slug] path tree, capturing the slug and
// whatever comes after it, so it can be split into "is this /admin or not".
const STORE_PATH_PATTERN = /^\/store\/([^/]+)((?:\/.*)?)$/;

function isStoreAdminSubpath(rest: string): boolean {
  return rest === "/admin" || rest.startsWith("/admin/");
}

// Platform admin routes require PLATFORM_ADMIN or SUPPORT_MODERATOR role.
const PLATFORM_ADMIN_PATTERN = /^\/admin/;

// The platform-admin panel lives on its own subdomain, supaadmin.biznest.space.
// Requires a `supaadmin.biznest.space` DNS record (or it can ride the
// existing `*.biznest.space` wildcard) pointed at the same Vercel project —
// no separate deployment needed, since this is still just the /supaadmin
// route tree under the hood, reached via a different host.

const ROOT_DOMAIN = "biznest.space";
const SUPAADMIN_HOST = `supaadmin.${ROOT_DOMAIN}`;

// Vercel's own wildcard-subdomain routing requires a paid plan, so
// *.biznest.space traffic is proxied through a Cloudflare Worker instead:
// the Worker rewrites the request's host to the plain apex domain (so
// Vercel recognizes it) and carries the real host the visitor typed in
// x-forwarded-host. Only trust that header when x-worker-secret matches —
// otherwise anyone could hit the Vercel deployment directly and spoof any
// host they like, bypassing the redirects below entirely.
const WORKER_PROXY_SECRET = process.env.WORKER_PROXY_SECRET;

function resolveHost(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const secretMatches =
    !!WORKER_PROXY_SECRET && req.headers.get("x-worker-secret") === WORKER_PROXY_SECRET;
  if (secretMatches && forwardedHost) {
    return forwardedHost.toLowerCase();
  }
  // Not proxied (local dev, Vercel previews) or the secret didn't match —
  // fall back to whatever host actually reached this deployment.
  return req.nextUrl.hostname.toLowerCase();
}

// Hosts that are BizNest itself, not a vendor's custom domain.
function isPlatformHost(host: string): boolean {
  return (
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === SUPAADMIN_HOST ||
    host === "localhost" ||
    host.endsWith(".vercel.app")
  );
}

// The real production apex — deliberately narrower than isPlatformHost,
// which also covers localhost and *.vercel.app previews. We only want to
// force the slug.biznest.space / biznest.space split where the wildcard
// subdomain actually resolves (production), so local dev and preview
// deployments keep working over plain /store/[slug] paths, admin included.
function isProductionRootHost(host: string): boolean {
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

/**
 * Every store gets a free `<slug>.biznest.space` address out of the box —
 * no DB lookup needed here, since the subdomain *is* the slug (unlike a
 * vendor's fully custom domain, where we have to look up which store owns
 * it via resolveCustomDomain). Requires a `*.biznest.space` wildcard DNS
 * record and a matching wildcard domain on the Vercel project; see notes
 * in lib/utils/slug.ts.
 */
function subdomainSlug(host: string): string | null {
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, -suffix.length);
  // "supaadmin" is reserved for the platform admin panel, not a store slug
  // (see the reserved-word guard in generateUniqueStoreSlug), but check here
  // too so this host can never be mistaken for a store subdomain even if
  // that guard is ever bypassed (e.g. a manually-edited slug in the DB).
  if (!sub || sub === "www" || sub === "supaadmin") return null;
  return sub;
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

/**
 * /supaadmin (including its own login page) must always be reachable, even
 * when site-wide maintenance mode is on — otherwise there'd be no way to
 * turn maintenance mode back off. Root layout can't see the pathname
 * directly, so we forward it as a request header it can check.
 */
function passThroughSupaAdmin(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-bn-skip-maintenance", "1");
  return NextResponse.next({ request: { headers } });
}

export default auth(async (req) => {
  const host = resolveHost(req);
  // The visitor's real, public-facing origin — use this for any redirect
  // the browser will follow. req.nextUrl.origin is NOT safe for that: when
  // proxied through the Worker, Vercel only ever sees the apex domain in
  // the actual request, so req.nextUrl.origin would always be
  // https://biznest.space even when the visitor is really on
  // velox-space.biznest.space, silently dropping them onto the wrong host
  // after login or any other redirect.
  const origin = `https://${host}`;
  const rawPathname = req.nextUrl.pathname;

  // supaadmin.biznest.space/ is just an easier-to-remember front door to the
  // panel — everything under it is still the plain /supaadmin route tree
  // (see all the hardcoded "/supaadmin/..." hrefs and revalidatePath calls
  // throughout the admin/dispute/site-settings actions), so visiting the
  // subdomain lands you on /supaadmin and every link from there behaves
  // exactly as it already did on the apex domain. biznest.space/supaadmin
  // keeps working too, unchanged, for anyone with it bookmarked.
  if (host === SUPAADMIN_HOST && rawPathname === "/") {
    return NextResponse.redirect(new URL("/supaadmin", origin));
  }

  // /supaadmin is gated entirely separately from everything else on this
  // site — a shared PIN, not a user login. Handle it first and return
  // early, so it never touches the NextAuth session logic below at all.
  if (rawPathname === "/supaadmin" || rawPathname.startsWith("/supaadmin/")) {
    if (rawPathname === "/supaadmin/login") {
      return passThroughSupaAdmin(req);
    }
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const valid = await verifyAdminToken(token);
    if (!valid) {
      const loginUrl = new URL("/supaadmin/login", origin);
      loginUrl.searchParams.set("callbackUrl", `${origin}${rawPathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return passThroughSupaAdmin(req);
  }

  // The customer-facing storefront must live at slug.biznest.space only —
  // biznest.space/store/[slug] should never be a second reachable address
  // for shoppers. Bounce it to the subdomain, but leave /store/[slug]/admin
  // alone: the dashboard is the one thing that's supposed to stay on the
  // root domain (see the admin-on-subdomain redirect below for the mirror
  // case). Scoped to isProductionRootHost so localhost and Vercel previews,
  // which don't have the wildcard subdomain, keep working over plain paths.
  if (isProductionRootHost(host)) {
    const storeMatch = rawPathname.match(STORE_PATH_PATTERN);
    if (storeMatch) {
      const [, matchedSlug, rest] = storeMatch;
      if (!isStoreAdminSubpath(rest)) {
        const redirectUrl = new URL(`https://${matchedSlug}.${ROOT_DOMAIN}${rest || "/"}`);
        redirectUrl.search = req.nextUrl.search;
        return NextResponse.redirect(redirectUrl, 308);
      }
    }
  }

  // req.nextUrl.origin here is intentional, not a bug: this is a same-
  // deployment server-to-server fetch, so it should hit whatever host
  // actually reached Vercel (the apex domain, when proxied) rather than
  // round-tripping back out through the Worker for no reason.
  const slug = subdomainSlug(host) ?? (await resolveCustomDomain(host, req.nextUrl.origin));
  const url = req.nextUrl.clone();

  if (slug) {
    // Mirror image of the redirect above: the seller dashboard is only
    // supposed to be reachable from the root biznest.space domain, never
    // from the storefront's own slug.biznest.space (or a vendor's custom
    // domain) — sellers manage the store from biznest.space, customers shop
    // at the subdomain. Check the *original* pathname (before it gets the
    // /store/[slug] prefix rewritten onto it below).
    if (isStoreAdminSubpath(rawPathname === "/" ? "" : rawPathname)) {
      const redirectUrl = new URL(`https://${ROOT_DOMAIN}/store/${slug}${rawPathname}`);
      redirectUrl.search = req.nextUrl.search;
      return NextResponse.redirect(redirectUrl, 308);
    }
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
    const loginUrl = new URL("/login", origin);
    // Absolute URL, not just `pathname` — a bare path like "/supaadmin" has
    // no host in it, so NextAuth's redirect callback would resolve it
    // against AUTH_URL (www.biznest.space) and lose the subdomain entirely.
    loginUrl.searchParams.set("callbackUrl", `${origin}${pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  if (PLATFORM_ADMIN_PATTERN.test(pathname)) {
    const role = req.auth.user.role;
    if (role !== "PLATFORM_ADMIN" && role !== "SUPPORT_MODERATOR") {
      // Non-admins hitting /admin get bounced to the homepage. (/supaadmin
      // is handled entirely separately above via the PIN cookie.)
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  return rewritten ? NextResponse.rewrite(url) : NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
