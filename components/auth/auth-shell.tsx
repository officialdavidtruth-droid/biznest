import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { isDarkColor, mix, readableOn } from "@/lib/storefront/readable-design";

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
// Trims a business's onboarding description down to a single tagline-length
// line for the auth-shell subhead — first sentence, capped so it never
// wraps past 2 lines next to the store name in the headline.
function toTagline(description: string | null | undefined): string | null {
  if (!description) return null;
  const firstSentence = description.split(/(?<=[.!?])\s/)[0]?.trim() ?? description.trim();
  if (firstSentence.length <= 90) return firstSentence.replace(/[.!?]+$/, "");
  return firstSentence.slice(0, 87).trim() + "...";
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const normHex = (c: string | null | undefined): string | null => {
  if (!c || !HEX.test(c.trim())) return null;
  const v = c.trim().toLowerCase();
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
};

/** "#rrggbb" -> "H S% L%", the format the shared --primary token uses. */
function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const d = max - min;
  let h = 0, sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  return `${h} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

/** Up to two initials, for stores that have not uploaded a logo yet. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "S").slice(0, 2);
  return letters.toUpperCase();
}

/** The store's logo, or its initials in the store colour -- never the platform's mark inside a store. */
function StoreMark({ name, logoUrl, size, accent, onAccent }: { name: string; logoUrl?: string | null; size: number; accent: string; onAccent: string }) {
  if (logoUrl) {
    return (
      <Image src={logoUrl} alt={name} width={size} height={size} style={{ width: size, height: size }} className="rounded-lg bg-white object-cover ring-1 ring-black/10" />
    );
  }
  return (
    <span
      aria-label={name}
      className="flex items-center justify-center rounded-lg font-bold ring-1 ring-black/10"
      style={{ width: size, height: size, background: accent, color: onAccent, fontSize: size * 0.4 }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  storeName,
  storeLogoUrl,
  accent,
  businessType,
  heroSubtitle,
  businessCategory,
  businessDescription,
  sellsProducts = true,
  offersServices = false,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  storeName?: string | null;
  storeLogoUrl?: string | null;
  accent?: string | null;
  // Onboarding-sourced content (see lib/actions/store-branding.ts) that lets
  // the copy below reflect what this specific business actually does,
  // instead of one generic sentence for every store on the platform.
  businessType?: string | null;
  heroSubtitle?: string | null;
  businessCategory?: string | null;
  businessDescription?: string | null;
  sellsProducts?: boolean;
  offersServices?: boolean;
  children: React.ReactNode;
}) {
  const isStoreContext = Boolean(storeName);
  // A store's own colour when it has one; a neutral slate (not BizNest green) when it has not set any yet.
  const storeAccent = normHex(accent) ?? "#1f2937";
  const accentColor = isStoreContext ? storeAccent : accent || "#0f6410"; // platform pages keep the BizNest green
  const onAccent = readableOn(accentColor);
  // Brand panel: a deep shade of the store colour, with a lighter glow, so the page reads as the store's own.
  const panelDeep = mix(accentColor, "#000000", isDarkColor(accentColor) ? 0.45 : 0.62);
  const panelMid = mix(accentColor, "#000000", isDarkColor(accentColor) ? 0.2 : 0.45);
  const onPanel = "#ffffff";
  // Accent used for text/icons on the dark panel: lifted when the store colour is too dark to read there.
  const highlight = isStoreContext ? (isDarkColor(accentColor) ? mix(accentColor, "#ffffff", 0.6) : accentColor) : "#6ee7a8";
  const formBg = isStoreContext ? mix(accentColor, "#ffffff", 0.965) : "#ffffff";
  // These tokens are what the shared inputs and buttons already read, so every field on the page follows the store.
  const brandVars = isStoreContext
    ? ({
        "--bn-accent-gradient": `linear-gradient(135deg, ${accentColor} 0%, ${mix(accentColor, "#000000", 0.16)} 100%)`,
        "--bn-on-accent": onAccent,
        "--bn-marigold": accentColor,
        "--primary": hexToHslTriplet(accentColor),
        "--primary-foreground": hexToHslTriplet(onAccent === "#ffffff" ? "#ffffff" : "#111111"),
        "--bn-ink": mix(accentColor, "#000000", 0.82),
      } as React.CSSProperties)
    : ({ "--bn-on-accent": "#ffffff", "--bn-accent-gradient": "linear-gradient(135deg, #14802a 0%, #0b5d1a 100%)" } as React.CSSProperties);

  // Vendor's own click-to-edit hero subtitle wins; otherwise fall back to a
  // trimmed version of their onboarding business description; otherwise the
  // generic line. Same fallback order the storefront hero itself uses.
  const tagline = heroSubtitle || toTagline(businessDescription);

  const modeLabel =
    sellsProducts && offersServices ? "products and services" : offersServices ? "services" : "products";

  const storeBenefits = [
    { icon: Zap, text: "Checkout in seconds, no re-typing your details" },
    {
      icon: ShieldCheck,
      text:
        businessCategory
          ? `Your ${businessCategory.toLowerCase()} orders and history, saved to your account`
          : "Your orders and history, saved to your account",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ background: formBg, ...brandVars }}>
      {/* Phones: the store's logo and name on its own colour, across the top. */}
      {isStoreContext && (
        <div
          className="flex items-center gap-3 px-6 py-5 sm:px-10 md:hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${mix(accentColor, "#000000", 0.25)} 100%)`, color: onAccent }}
        >
          <StoreMark name={storeName ?? "Store"} logoUrl={storeLogoUrl} size={40} accent={onAccent} onAccent={accentColor} />
          <span className="text-base font-semibold">{storeName}</span>
        </div>
      )}

      {/* Brand panel — hidden below md, this is the "signature" half of
          the layout: the receipt-strip benefit list ties back to
          BizNest's commerce/POS identity instead of generic bullet
          points. */}
      <div
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden px-12 py-12 md:flex lg:px-16"
        style={{
          background: isStoreContext
            ? `radial-gradient(120% 90% at 12% -10%, ${mix(accentColor, "#ffffff", 0.18)}55 0%, transparent 55%), linear-gradient(165deg, ${panelMid} 0%, ${panelDeep} 100%)`
            : "radial-gradient(90% 60% at 100% 0%, rgba(110,231,168,0.20) 0%, transparent 60%), radial-gradient(80% 60% at 0% 100%, rgba(20,128,42,0.45) 0%, transparent 60%), linear-gradient(160deg, #0c3a14 0%, #06200c 55%, #030f06 100%)",
        }}
      >
        <div className="bn-dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="bn-glow-orb h-72 w-72"
          style={{ background: `${accentColor}38`, top: "-6rem", left: "-6rem" }}
        />

        <div className="relative z-10 flex items-center gap-3">
          {isStoreContext ? (
            <StoreMark name={storeName ?? "Store"} logoUrl={storeLogoUrl} size={40} accent={accentColor} onAccent={onAccent} />
          ) : (
            <Image src="/icon-192.png" alt="BizNest" width={44} height={44} priority className="h-11 w-11 rounded-xl shadow-lg ring-1 ring-white/20" />
          )}
          <span className="text-lg font-semibold tracking-tight" style={{ color: onPanel }}>
            {storeName ?? "BizNest"}
          </span>
        </div>

        <div className="relative z-10 max-w-sm bn-fade-up">
          <p
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ color: highlight, borderColor: `${highlight}55`, background: `${highlight}14` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: highlight }} />
            {eyebrow}
          </p>
          <h1 className="text-[2.4rem] font-semibold leading-[1.12] tracking-tight text-white">
            {isStoreContext ? (
              <>
                Everything you love from{" "}
                <span style={{ color: highlight }}>{storeName}</span>, one sign-in away.
              </>
            ) : (
              <>
                Run your business.
                <br />
                <span style={{ color: highlight }}>Not your errands.</span>
              </>
            )}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            {isStoreContext
              ? tagline || `Track orders, save your details for faster checkout on ${modeLabel}, and pick up right where you left off.`
              : "Storefronts, staff, and payments, in one place built for how Nigerian businesses actually sell."}
          </p>
        </div>

        {!isStoreContext && (
          <div className="relative z-10 flex max-w-sm flex-wrap gap-2" aria-label="What you can run on BizNest">
            {["Online store", "Point of sale", "Bookings", "Orders", "Staff", "Payments"].map((t) => (
              <span key={t} className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/90">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="relative z-10 space-y-3">
          {(isStoreContext
            ? storeBenefits
            : [
                { icon: Zap, text: "Live in minutes with a store, staff, and payments" },
                { icon: ShieldCheck, text: "Real-time inventory, invoices, and Paystack billing" },
                { icon: Sparkles, text: "Built for how Nigerian small businesses actually sell" },
              ]
          ).map(({ icon: Icon, text }) => (
            <div key={text} className="bn-receipt-row text-sm text-white/85" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <Icon className="h-4 w-4 shrink-0" style={{ color: highlight }} />
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
          {!isStoreContext && (
            <Link href="/" className="mb-8 flex items-center gap-2 md:hidden">
              <Image src="/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
              <span className="text-sm font-semibold text-[var(--bn-ink)]">BizNest</span>
            </Link>
          )}

          <h2 className="text-[1.75rem] font-semibold tracking-tight text-[var(--bn-ink)]">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
