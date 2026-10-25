import Link from "next/link";
import { Store, ShoppingBag, CalendarCheck, Wallet } from "lucide-react";

const FEATURES = [
  { icon: Store, label: "Your store" },
  { icon: ShoppingBag, label: "Orders" },
  { icon: CalendarCheck, label: "Bookings" },
  { icon: Wallet, label: "Payments" },
];

/** First screen of the native app for signed-out users: a full-screen
 *  welcome with big touch targets, not the marketing homepage. */
export function AppWelcome() {
  return (
    <div
      className="bn-app-welcome flex min-h-screen flex-col items-center justify-between px-6 text-white"
      style={{ background: "var(--bn-hero-gradient)", paddingTop: "12vh", paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="BizNest" width={96} height={96} className="bn-welcome-logo rounded-[26px] shadow-2xl" />
        <h1 className="bn-welcome-rise mt-6 text-3xl font-bold tracking-tight" style={{ animationDelay: "0.15s" }}>BizNest</h1>
        <p className="bn-welcome-rise mt-2 max-w-xs text-[15px] opacity-80" style={{ animationDelay: "0.25s" }}>
          Run your store, orders, bookings and customers from your pocket.
        </p>
        <div className="mt-8 grid grid-cols-4 gap-3">
          {FEATURES.map(({ icon: Icon, label }, i) => (
            <div key={label} className="bn-welcome-rise flex flex-col items-center gap-2" style={{ animationDelay: `${0.35 + i * 0.07}s` }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[11px] opacity-80">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bn-welcome-rise w-full max-w-sm space-y-3" style={{ animationDelay: "0.7s" }}>
        <Link href="/login" className="flex w-full items-center justify-center rounded-2xl bg-white py-4 text-base font-semibold text-[#0f6410]">
          Sign in
        </Link>
        <Link href="/register" className="flex w-full items-center justify-center rounded-2xl bg-white/10 py-4 text-base font-semibold ring-1 ring-white/25">
          Create account
        </Link>
      </div>
    </div>
  );
}
