import Link from "next/link";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/forms/sign-out-button";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500"] });

const STALLS = [
  { name: "Stacey's Paradise", cat: "Fashion" },
  { name: "Lens & Light Studio", cat: "Photography" },
  { name: "Kaya Kitchen", cat: "Catering" },
  { name: "Voltage Repairs", cat: "Automotive" },
  { name: "Bloom & Co.", cat: "Beauty" },
  { name: "Nairaworks", cat: "Software" },
  { name: "The Grain House", cat: "Groceries" },
  { name: "Studio Nine", cat: "Design" },
  { name: "FitCore", cat: "Fitness" },
  { name: "Hearth Interiors", cat: "Furniture" },
  { name: "Loom Tailors", cat: "Tailoring" },
  { name: "Pulse Events", cat: "Event Planning" },
];

const STEPS = [
  {
    n: "01",
    title: "Verify your business",
    body: "Registered or not — upload your certificate, or your ID, a selfie, and two guarantors. Reviewed by a real person, not a black box.",
  },
  {
    n: "02",
    title: "Open your store",
    body: "Pick a name, get a live storefront and admin dashboard on the spot. No code, no waiting on a developer.",
  },
  {
    n: "03",
    title: "Sell, get paid",
    body: "List products, services, or bookings. Payments land in your own Paystack or Flutterwave account — we never touch your funds directly.",
  },
];

const CATEGORIES = [
  "Fashion", "Electronics", "Beauty", "Food & Groceries", "Home & Furniture",
  "Photography", "Software Development", "Event Planning", "Automotive",
  "Health & Fitness", "Real Estate", "Logistics",
];

export default async function HomePage() {
  const session = await auth();
  const plans = await prisma.subscription.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen`}
      style={{ background: "var(--bn-ink)", color: "var(--bn-ivory)", fontFamily: "var(--font-body)" }}
    >
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-lg tracking-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          BizNest
        </span>
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          {session?.user ? (
            <>
              <Link href="/onboarding/business-verification" className="opacity-80 transition hover:opacity-100">
                Dashboard
              </Link>
              <SignOutButton className="rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110" />
            </>
          ) : (
            <>
              <Link href="/login" className="opacity-80 transition hover:opacity-100">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
                style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
              >
                Open your store
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="grid gap-10 px-6 pb-16 pt-8 sm:px-10 lg:grid-cols-2 lg:items-center lg:gap-6 lg:pt-16">
        <div className="bn-fade-up">
          <p
            className="mb-4 text-xs uppercase tracking-[0.2em]"
            style={{ color: "var(--bn-marigold)", fontFamily: "var(--font-mono)" }}
          >
            One marketplace, every kind of business
          </p>
          <h1
            className="text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Your store belongs
            <br />
            in the <span style={{ color: "var(--bn-marigold)" }}>nest</span>.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: "var(--bn-mute)" }}>
            BizNest is where sellers of products, services, and bookings get a real storefront,
            a real dashboard, and real payments — verified, protected, and built to grow with you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session?.user ? (
              <Link
                href="/onboarding/business-verification"
                className="rounded-full px-6 py-3 text-sm font-medium transition hover:brightness-110"
                style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
              >
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-full px-6 py-3 text-sm font-medium transition hover:brightness-110"
                  style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
                >
                  Start selling — it's free
                </Link>
                <Link
                  href="/login"
                  className="rounded-full px-6 py-3 text-sm font-medium transition"
                  style={{ border: "1px solid var(--bn-ink-line)", color: "var(--bn-ivory)" }}
                >
                  I already have a store
                </Link>
              </>
            )}
          </div>
          <div
            className="mt-10 flex gap-8 text-sm"
            style={{ fontFamily: "var(--font-mono)", color: "var(--bn-mute)" }}
          >
            <div>
              <span className="block text-xl" style={{ color: "var(--bn-ivory)" }}>50+</span>
              product & service categories
            </div>
            <div>
              <span className="block text-xl" style={{ color: "var(--bn-ivory)" }}>2</span>
              payment providers, your account
            </div>
          </div>
        </div>

        {/* Signature element: two rows of storefront tiles drifting past each other,
            like walking down a market alley of many different stores. */}
        <div
          className="relative -mx-6 overflow-hidden py-2 sm:-mx-10 lg:mx-0 lg:rounded-2xl"
          style={{
            background: "var(--bn-ink-raised)",
            border: "1px solid var(--bn-ink-line)",
            maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <Row stalls={STALLS} direction="left" />
          <Row stalls={[...STALLS].reverse()} direction="right" />
          <Row stalls={STALLS.slice().sort(() => 1)} direction="left" />
        </div>
      </section>

      {/* How it works — a real 3-step sequence, so numbering earns its place */}
      <section className="px-6 py-16 sm:px-10 lg:py-24">
        <h2 className="mb-10 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          From idea to open for business
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span
                className="text-sm"
                style={{ fontFamily: "var(--font-mono)", color: "var(--bn-marigold)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--bn-mute)" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="px-6 py-16 sm:px-10 lg:py-20" style={{ background: "var(--bn-ink-raised)" }}>
        <h2 className="mb-8 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Whatever you sell, there's a stall for it
        </h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full px-4 py-2 text-sm"
              style={{ border: "1px solid var(--bn-ink-line)", color: "var(--bn-mute)" }}
            >
              {c}
            </span>
          ))}
          <span
            className="rounded-full px-4 py-2 text-sm"
            style={{ background: "var(--bn-jade)", color: "var(--bn-ink)" }}
          >
            +40 more
          </span>
        </div>
      </section>

      {/* Quote */}
      <section className="px-6 py-20 sm:px-10 lg:py-28">
        <blockquote
          className="max-w-2xl text-2xl leading-snug sm:text-3xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          "I didn't touch a line of code. I verified my business on Monday, and by Friday
          customers were paying me directly through my own Paystack account."
        </blockquote>
        <p className="mt-4 text-sm" style={{ color: "var(--bn-mute)" }}>
          — a BizNest store owner
        </p>
      </section>

      {/* Pricing — pulled live from the Subscription table, not hardcoded copy,
          so this page can never drift out of sync with what a store actually gets. */}
      <section id="pricing" className="px-6 py-16 sm:px-10 lg:py-24">
        <h2 className="mb-3 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Simple pricing, real ownership
        </h2>
        <p className="mb-10 max-w-lg text-sm" style={{ color: "var(--bn-mute)" }}>
          Start free. Upgrade when you're ready for higher limits, a lower commission,
          and your own domain name.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const features = p.features as { products?: number; services?: number; customDomain?: boolean };
            const featured = p.name === "Enterprise";
            return (
              <div
                key={p.id}
                className="relative rounded-2xl p-6"
                style={{
                  background: featured ? "var(--bn-marigold)" : "var(--bn-ink-raised)",
                  color: featured ? "var(--bn-ink)" : "var(--bn-ivory)",
                  border: featured ? "none" : "1px solid var(--bn-ink-line)",
                }}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {Number(p.price) === 0 ? "Free" : `₦${Number(p.price).toLocaleString()}`}
                  {Number(p.price) > 0 && <span className="text-sm font-normal opacity-70">/mo</span>}
                </p>
                <ul className="mt-5 space-y-2 text-sm" style={{ opacity: featured ? 0.85 : 0.75 }}>
                  <li>{Number(p.commissionRate)}% commission per sale</li>
                  <li>{features.products === -1 ? "Unlimited products" : `Up to ${features.products ?? 0} products`}</li>
                  <li>{features.services === -1 ? "Unlimited services" : `Up to ${features.services ?? 0} services`}</li>
                  <li className="font-medium">{features.customDomain ? "✓ Your own domain name" : "Runs on your biznest.space address"}</li>
                </ul>
                <Link
                  href={session?.user ? "/onboarding/business-verification" : "/register"}
                  className="mt-6 block rounded-full py-2.5 text-center text-sm font-medium transition hover:brightness-110"
                  style={{
                    background: featured ? "var(--bn-ink)" : "var(--bn-marigold)",
                    color: featured ? "var(--bn-ivory)" : "var(--bn-ink)",
                  }}
                >
                  {Number(p.price) === 0 ? "Start free" : "Get started"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & security — states what's actually built, not generic marketing claims */}
      <section className="px-6 py-16 sm:px-10 lg:py-24">
        <h2 className="mb-10 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Built for trust, not just transactions
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: "🪪", title: "Verified sellers", body: "ID and guarantor checks (or business registration) before anyone opens a store — reviewed by a real person." },
            { icon: "🔐", title: "Two-factor by default", body: "Every store admin dashboard requires 2FA. Your storefront can't be hijacked from a leaked password alone." },
            { icon: "🏦", title: "Payments go straight to you", body: "Paystack and Flutterwave subaccounts settle directly to your bank. We never hold your money." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl p-6" style={{ background: "var(--bn-ink-raised)", border: "1px solid var(--bn-ink-line)" }}>
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--bn-mute)" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center sm:px-10 lg:py-28">
        <h2
          className="mx-auto max-w-xl text-3xl sm:text-4xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Your stall is waiting.
        </h2>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-full px-8 py-3.5 text-sm font-medium transition hover:brightness-110"
          style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
        >
          Open your store
        </Link>
      </section>

      <footer style={{ borderTop: "1px solid var(--bn-ink-line)" }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          <div>
            <span className="text-lg tracking-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              BizNest
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "var(--bn-mute)" }}>
              A verified marketplace for products, services, and bookings — your store,
              your payments, your own domain on ours.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bn-ivory)" }}>Platform</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bn-mute)" }}>
              <li><Link href="/register" className="hover:opacity-80">Open a store</Link></li>
              <li><Link href="/login" className="hover:opacity-80">Sign in</Link></li>
              <li><a href="#pricing" className="hover:opacity-80">Pricing</a></li>
              <li><a href="#categories" className="hover:opacity-80">Categories</a></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bn-ivory)" }}>Legal</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bn-mute)" }}>
              <li><Link href="/privacy" className="hover:opacity-80">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:opacity-80">Terms of Service</Link></li>
              <li><Link href="/seller-agreement" className="hover:opacity-80">Seller Agreement</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bn-ivory)" }}>Support</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bn-mute)" }}>
              <li><a href="mailto:support@biznest.space" className="hover:opacity-80">support@biznest.space</a></li>
            </ul>
          </div>
        </div>
        <div
          className="flex flex-col items-center gap-2 px-6 py-6 text-center text-xs sm:flex-row sm:justify-between sm:px-10"
          style={{ borderTop: "1px solid var(--bn-ink-line)", color: "var(--bn-mute)" }}
        >
          <span>© {new Date().getFullYear()} BizNest. All rights reserved.</span>
          <span>Payments by Paystack & Flutterwave · SSL encrypted</span>
        </div>
      </footer>
    </div>
  );
}

function Row({ stalls, direction }: { stalls: typeof STALLS; direction: "left" | "right" }) {
  const loop = [...stalls, ...stalls];
  return (
    <div className={`flex w-max gap-3 px-3 py-1.5 ${direction === "left" ? "bn-marquee-left" : "bn-marquee-right"}`}>
      {loop.map((s, i) => (
        <div
          key={`${s.name}-${i}`}
          className="flex w-44 shrink-0 flex-col rounded-xl px-4 py-3"
          style={{ background: "var(--bn-ink)", border: "1px solid var(--bn-ink-line)" }}
        >
          <span
            className="h-1.5 w-6 rounded-full"
            style={{ background: i % 3 === 0 ? "var(--bn-marigold)" : "var(--bn-jade)" }}
          />
          <span className="mt-2 truncate text-sm font-medium">{s.name}</span>
          <span className="text-xs" style={{ color: "var(--bn-mute)" }}>
            {s.cat}
          </span>
        </div>
      ))}
    </div>
  );
}
