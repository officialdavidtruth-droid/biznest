"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppTabBar } from "./app-tab-bar";

const SPLASH_KEY = "bn-splash-shown";

function inApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("BizNestApp");
}

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

/**
 * Native-app behaviour layered on the web UI. Renders nothing and does
 * nothing in a normal browser; only active inside the BizNest Android app.
 *  - animated logo launch screen (once per app session)
 *  - top progress bar + logo loader while navigating
 *  - page enter transition on every route change
 *  - silent background refresh (no pull-to-refresh, no spinner)
 *  - light haptic tick on taps
 */
export function AppShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const routeKey = `${pathname}?${search?.toString() ?? ""}`;

  const [active, setActive] = useState(false);
  const [splash, setSplash] = useState<"off" | "show" | "hide">("off");
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();
  const lastInput = useRef(0);
  const lastRefresh = useRef(Date.now());
  const firstRoute = useRef(true);
  const navTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!inApp()) return;
    setActive(true);
    document.documentElement.setAttribute("data-app", "1");
    if (navigator.userAgent.includes("BizNestDesktop")) document.documentElement.setAttribute("data-desktop", "1");
    let seen = false;
    try { seen = sessionStorage.getItem(SPLASH_KEY) === "1"; } catch {}
    if (!seen) {
      setSplash("show");
      try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
      const t1 = setTimeout(() => setSplash("hide"), 1300);
      const t2 = setTimeout(() => setSplash("off"), 1750);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, []);

  // Route changed: stop the loader and play the page-enter animation.
  useEffect(() => {
    if (!active) return;
    setNavigating(false);
    clearTimeout(navTimeout.current);
    if (firstRoute.current) { firstRoute.current = false; return; }
    const el = document.getElementById("bn-app-content");
    if (el) {
      el.classList.remove("bn-page-enter");
      void el.offsetWidth;
      el.classList.add("bn-page-enter");
      el.addEventListener("animationend", () => el.classList.remove("bn-page-enter"), { once: true });
    }
  }, [routeKey, active]);

  // Start the loader on internal link taps; haptic tick on buttons/links.
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      const btn = t?.closest?.("button,[role=button]");
      if (a || btn) haptic();
      if (a && !a.target && a.origin === location.origin && a.pathname + a.search !== location.pathname + location.search && !a.hasAttribute("download")) {
        setNavigating(true);
        clearTimeout(navTimeout.current);
        navTimeout.current = setTimeout(() => setNavigating(false), 8000);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  // Silent background refresh. Re-fetches server data via router.refresh()
  // (client state, scroll position, typed text and open dialogs are kept), so
  // it never reloads the page or shows any indicator. It only runs while the
  // app is visible and online, and is skipped whenever the user is busy:
  // typing/focused in a field, a dialog is open, or they just touched the screen.
  useEffect(() => {
    if (!active) return;
    const INTERVAL = 30_000;
    const IDLE_MS = 4_000;
    const markInput = () => { lastInput.current = Date.now(); };
    const busy = () => {
      if (Date.now() - lastInput.current < IDLE_MS) return true;
      const el = document.activeElement as HTMLElement | null;
      if (el?.matches?.("input,textarea,select,[contenteditable='true']")) return true;
      if (document.querySelector("[role='dialog'],[aria-modal='true'],dialog[open]")) return true;
      return false;
    };
    const tryRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (busy()) return;
      lastRefresh.current = Date.now();
      try { router.refresh(); } catch {}
    };
    const timer = setInterval(tryRefresh, INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > INTERVAL) tryRefresh();
    };
    const evts: Array<keyof DocumentEventMap> = ["touchstart", "touchmove", "keydown", "pointerdown"];
    evts.forEach((e) => document.addEventListener(e, markInput, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      clearInterval(timer);
      evts.forEach((e) => document.removeEventListener(e, markInput, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [active, router]);

  if (!active) return null;

  return (
    <>
      {splash !== "off" && (
        <div className={`bn-splash ${splash === "hide" ? "bn-splash-out" : ""}`} aria-hidden>
          <div className="bn-splash-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={104} height={104} className="bn-splash-logo" />
          <div className="bn-splash-word">BizNest</div>
          <div className="bn-splash-bar"><span /></div>
        </div>
      )}

      <AppTabBar />

      <div className={`bn-navbar ${navigating ? "bn-navbar-on" : ""}`} aria-hidden><span /></div>
    </>
  );
}
