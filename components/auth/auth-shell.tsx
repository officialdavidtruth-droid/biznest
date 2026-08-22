import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

/**
 * Shared visual frame for every app/(auth)/** page (login, register,
 * forgot-password, reset-password). One file so the four pages can't drift
 * into four different looks over time — only the right-hand `children`
 * (the actual form) changes between them.
 *
 * Left panel carries the brand: BizNest's own dark lush-forest gradient
 * (--bn-ink / --bn-marigold, same tokens as the marketing homepage) when
 * there's no store context, or the store's own logo + accent color when a
 * customer arrived via a store's own sign-in link — so "sign in to shop"
 * actually feels like it belongs to that store, not a generic platform
 * screen bolted on the side.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  storeName,
  storeLogoUrl,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  storeName?: string | null;
  storeLogoUrl?: string | null;
  accent?: string | null;
  children: React.ReactNode;
}) {
  const isStoreContext = Boolean(storeName);
  const accentColor = accent || "#34d399";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel — hidden below md, this is the "signature" half of
          the layout: the receipt-strip benefit list ties back to
          BizNest's commerce/POS identity instead of generic bullet
          points. */}
      <div
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden px-12 py-12 md:flex lg:px-16"
        style={{
          background: isStoreContext
            ? `radial-gradient(120% 90% at 12% -10%, ${accentColor}29 0%, transparent 55%), linear-gradient(165deg, #0e2b1c 0%, #0a1c12 45%, #05100a 100%)`
            : "var(--bn-hero-gradient)",
        }}
      >
        <div className="bn-dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="bn-glow-orb h-72 w-72"
          style={{ background: `${accentColor}38`, top: "-6rem", left: "-6rem" }}
        />

        <div className="relative z-10 flex items-center gap-3">
          {storeLogoUrl ? (
            <Image
              src={storeLogoUrl}
              alt={storeName ?? "Store"}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/15"
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-[#05100a]"
              style={{ background: "var(--bn-accent-gradient)" }}
            >
              BN
            </span>
          )}
          <span className="text-sm font-semibold tracking-wide text-white">
            {storeName ?? "BizNest"}
          </span>
        </div>

        <div className="relative z-10 max-w-sm bn-fade-up">
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: accentColor }}
          >
            {eyebrow}
          </p>
          <h1 className="text-[2.1rem] font-semibold leading-[1.15] text-white">
            {isStoreContext ? (
              <>
                Everything you love from{" "}
                <span style={{ color: accentColor }}>{storeName}</span>, one sign-in away.
              </>
            ) : (
              <>
                Run your business.
                <br />
                <span style={{ color: accentColor }}>Not your errands.</span>
              </>
            )}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--bn-mute)]">
            {isStoreContext
              ? "Track orders, save your details for faster checkout, and pick up right where you left off."
              : "Storefronts, staff, and payments, in one place built for how Nigerian businesses actually sell."}
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {(isStoreContext
            ? [
                { icon: Zap, text: "Checkout in seconds, no re-typing your details" },
                { icon: ShieldCheck, text: "Your orders and history, saved to your account" },
                { icon: Sparkles, text: "This account only works on this store, by design" },
              ]
            : [
                { icon: Zap, text: "Live in minutes with a store, staff, and payments" },
                { icon: ShieldCheck, text: "Real-time inventory, invoices, and Paystack billing" },
                { icon: Sparkles, text: "Built for how Nigerian small businesses actually sell" },
              ]
          ).map(({ icon: Icon, text }) => (
            <div key={text} className="bn-receipt-row text-sm text-white/85">
              <Icon className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 md:w-[56%] lg:px-20">
        <div className="mx-auto w-full max-w-sm bn-fade-up">
          {/* Compact brand mark shown only on mobile, where the left
              panel is hidden entirely. */}
          <Link href="/" className="mb-8 flex items-center gap-2 md:hidden">
            {storeLogoUrl ? (
              <Image
                src={storeLogoUrl}
                alt={storeName ?? "Store"}
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: "var(--bn-accent-gradient)", color: "#05100a" }}
              >
                BN
              </span>
            )}
            <span className="text-sm font-semibold text-[var(--bn-ink)]">
              {storeName ?? "BizNest"}
            </span>
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-[var(--bn-ink)]">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
