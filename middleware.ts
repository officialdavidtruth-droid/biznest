import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";

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

// Storefront checkout: /store/[slug]/checkout — customers can browse and
// build a cart (cart lives in localStorage, no account needed) but must be
// signed in to actually place an order. This is a UX front door: the real
// enforcement already lives in createOrder/createBooking (see
// lib/actions/order.ts, lib/actions/booking.ts), which reject anonymous
// requests server-side regardless of whether this pattern ever changes.
// Gating it here too means someone finds out *before* filling out an
// entire checkout form across any of the 12+ storefront templates, not
// after submitting it. Deliberately doesn't cover /cart — viewing your own
// (possibly empty) cart isn't "shopping" and shouldn't force a sign-in.
const STORE_CHECKOUT_PATTERN = /^\/store\/[^/]+\/checkout/;

// Platform admin routes require PLATFORM_ADMIN or SUPPORT_MODERATOR role.
const PLATFORM_ADMIN_PATTERN = /^\/admin/;

// The platform-admin panel additionally lives on its own subdomain,
// supaadmin.biznest.space — this is unrelated to store slugs (which are
// path-based, see pathSlug below) and still needs its own DNS record
// pointed at the same Vercel project. No separate deployment needed,
// since this is still just the /supaadmin route tree under the hood,
// reached via a different host.

// These live at app/(auth)/** and have no store-scoped equivalent (unlike
// e.g. /orders, which intentionally maps to /store/<slug>/orders on a
// vendor's custom domain — see the rewrite below). A vendor's custom
// domain covers every path on that host, so without this list a shopper
// clicking "Sign in" on mystore.com would get silently rewritten to
// /store/<slug>/login — a route that doesn't exist — instead of ever
// reaching the actual login page. Keep in sync with RESERVED_SLUGS' own
// "app/(auth)" section.
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

const ROOT_DOMAIN = "biznest.space";
const SUPAADMIN_HOST = `supaadmin.${ROOT_DOMAIN}`;

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

/**
 * Every store lives at biznest.space/<slug> — no DB lookup needed here,
 * since the first path segment *is* the slug (unlike a vendor's fully
 * custom domain, where we have to look up which store owns it via
 * resolveCustomDomain). We only need to make sure the segment isn't one
 * of the site's real top-level routes; RESERVED_SLUGS (shared with
 * generateUniqueStoreSlug, so a store can never be created with a
 * colliding slug in the first place) is the single source of truth for
 * that. Non-existent slugs still fall through to /store/[slug]'s own
 * not-found handling, same as before.
 */
function pathSlug(pathname: string): { slug: string | null; rest: string } {
  const segments = pathname.split("/").filter(Boolean);
  const [first, ...remaining] = segments;
  if (!first || RESERVED_SLUGS.has(first)) {
    return { slug: null, rest: pathname };
  }
  const rest = `/${remaining.join("/")}`;
  return { slug: first, rest: rest === "/" ? "" : rest };
}

/**
 * In-memory cache for custom-domain -> slug lookups, keyed by host. Without
 * this, every single request to a vendor's custom domain (mystore.com) paid
 * for a full network round-trip to /api/resolve-domain (which itself hits
 * Postgres) before the actual page could even start rendering — on top of
 * whatever the page's own data fetching costs. A custom domain is an
 * Enterprise/Business Mogul feature, so as more of those stores launch this
 * gets slower for a growing fraction of traffic, not just occasionally.
 *
 * Edge middleware instances on Vercel stay warm across many requests to the
 * same region, so a plain module-scope Map gives a real, meaningful hit
 * rate in practice even without a shared cache like Redis. A short TTL
 * (5 min) keeps custom-domain reassignment/removal from being stuck stale
 * for long, while still eliminating the round-trip for the overwhelming
 * majority of requests.
 */
const customDomainCache = new Map<string, { slug: string | null; expiresAt: number }>();
const CUSTOM_DOMAIN_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves a custom domain (e.g. mystore.com, an Enterprise/Business Mogul
 * feature) to its store slug by calling app/api/resolve-domain (Node.js
 * runtime, so it can use Prisma safely — middleware itself cannot).
 */
async function resolveCustomDomain(host: string, origin: string): Promise<string | null> {
  if (isPlatformHost(host)) return null;

  const cached = customDomainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  try {
    const res = await fetch(new URL(`/api/resolve-domain?host=${host}`, origin));
    if (!res.ok) {
      // Don't cache failures — a transient resolver error shouldn't lock a
      // legitimate custom domain out for the full TTL.
      return null;
    }
    const { slug } = (await res.json()) as { slug: string | null };
    customDomainCache.set(host, { slug, expiresAt: Date.now() + CUSTOM_DOMAIN_TTL_MS });
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
  const host = req.nextUrl.hostname.toLowerCase();
  const rawPathname = req.nextUrl.pathname;

  // supaadmin.biznest.space/ is just an easier-to-remember front door to the
  // panel — everything under it is still the plain /supaadmin route tree
  // (see all the hardcoded "/supaadmin/..." hrefs and revalidatePath calls
  // throughout the admin/dispute/site-settings actions), so visiting the
  // subdomain lands you on /supaadmin and every link from there behaves
  // exactly as it already did on the apex domain. biznest.space/supaadmin
  // keeps working too, unchanged, for anyone with it bookmarked.
  if (host === SUPAADMIN_HOST && rawPathname === "/") {
    return NextResponse.redirect(new URL("/supaadmin", req.nextUrl.origin));
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
      const loginUrl = new URL("/supaadmin/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", `${req.nextUrl.origin}${rawPathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return passThroughSupaAdmin(req);
  }

  const url = req.nextUrl.clone();
  let slug: string | null = null;

  if (isPlatformHost(host)) {
    // biznest.space/<slug> — strip the slug off the front of the path and
    // rewrite what's left onto /store/<slug>.
    const parsed = pathSlug(rawPathname);
    slug = parsed.slug;
    if (slug) {
      url.pathname = `/store/${slug}${parsed.rest}`;
    }
  } else if (AUTH_PATHS.some((p) => rawPathname === p || rawPathname.startsWith(`${p}/`))) {
    // Sign in/up on a custom domain: leave the path alone so it hits the
    // real app/(auth) page directly, same as it would on the platform
    // host. slug stays null (no rewrite) — AccountLink already appends
    // ?store=<slug> so the auth pages can still show this store's
    // branding without needing a rewritten path.
  } else {
    // A vendor's own custom domain (e.g. mystore.com) maps entirely onto
    // one store — the whole path belongs to it, unlike the platform host
    // above where only the first segment is the slug.
    slug = await resolveCustomDomain(host, req.nextUrl.origin);
    if (slug) {
      url.pathname = `/store/${slug}${rawPathname === "/" ? "" : rawPathname}`;
    }
  }

  const { pathname } = url;
  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STORE_ADMIN_PATTERN.test(pathname) ||
    STORE_CHECKOUT_PATTERN.test(pathname);

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
    // Bounced off checkout specifically (as opposed to /admin, /account,
    // etc): carry the store slug through so /login shows this store's own
    // branding instead of generic BizNest chrome — same as AccountLink's
    // header sign-in link already does.
    if (STORE_CHECKOUT_PATTERN.test(pathname)) {
      const slugMatch = pathname.match(/^\/store\/([^/]+)\//);
      if (slugMatch) loginUrl.searchParams.set("store", slugMatch[1]);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (PLATFORM_ADMIN_PATTERN.test(pathname)) {
    const role = req.auth.user.role;
    if (role !== "PLATFORM_ADMIN" && role !== "SUPPORT_MODERATOR") {
      // Non-admins hitting /admin get bounced to the homepage. (/supaadmin
      // is handled entirely separately above via the PIN cookie.)
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  // Forward which admin sub-page this is (e.g. "/settings") as a header so
  // the layout — which runs on the Node runtime and can actually query
  // StoreStaff.permissions — can enforce per-staff-member permissions
  // (see findNavItemForPath in lib/constants/dashboard-nav.ts and its use
  // in app/store/[slug]/admin/layout.tsx). Middleware itself can't do this
  // check: it's Edge runtime and cannot run Prisma.
  const storeAdminMatch = STORE_ADMIN_PATTERN.test(pathname);
  if (storeAdminMatch) {
    const adminIndex = pathname.indexOf("/admin");
    const subpath = pathname.slice(adminIndex + "/admin".length) || "/";
    const headers = new Headers(req.headers);
    headers.set("x-bn-admin-subpath", subpath);
    return rewritten
      ? NextResponse.rewrite(url, { request: { headers } })
      : NextResponse.next({ request: { headers } });
  }

  return rewritten ? NextResponse.rewrite(url) : NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
