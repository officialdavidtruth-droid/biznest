"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppTabBar } from "./app-tab-bar";

const SPLASH_KEY = "bn-splash-shown";

function inApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("BizNestApp");
}

/** True only if EVERY scrollable ancestor (and the page itself) is at the very top. */
function atTop(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return (document.scrollingElement?.scrollTop ?? 0) <= 0 && window.scrollY <= 0;
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
 *  - pull-to-refresh with the logo
 *  - light haptic tick on taps
 */
export function AppShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const routeKey = `${pathname}?${search?.toString() ?? ""}`;

  const [active, setActive] = useState(false);
  const [splash, setSplash] = useState<"off" | "show" | "hide">("off");
  const [navigating, setNavigating] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const firstRoute = useRef(true);
  const navTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!inApp()) return;
    setActive(true);
    document.documentElement.setAttribute("data-app", "1");
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

  // Pull to refresh: only when the page is already at the very top and the
  // finger drags DOWN, like a browser. Any scrolling cancels it.
  useEffect(() => {
    if (!active) return;
    let startY = 0;
    let startX = 0;
    let target: EventTarget | null = null;
    let tracking = false;
    let pulling = false;
    let dist = 0;
    const MAX = 110;
    const TRIGGER = 56;
    const reset = () => { tracking = false; pulling = false; dist = 0; setPull(0); };
    const start = (e: TouchEvent) => {
      tracking = false; pulling = false; dist = 0;
      if (e.touches.length !== 1) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input,textarea,select,[contenteditable],[data-no-pull]")) return;
      if (!atTop(e.target)) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      target = e.target;
      tracking = true;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      // The page scrolled (or was not really at the top): never pull.
      if (!atTop(target)) { reset(); return; }
      const dy = e.touches[0].clientY - startY;
      const dx = Math.abs(e.touches[0].clientX - startX);
      if (!pulling) {
        if (dy < -4 || dx > Math.abs(dy)) { tracking = false; return; } // going up / sideways
        if (dy < 14) return;                                            // small dead zone
        pulling = true;
      }
      dist = Math.min(MAX, (dy - 14) * 0.5);
      setPull(dist);
    };
    const end = () => {
      if (!tracking) return;
      const go = pulling && dist >= TRIGGER;
      tracking = false; pulling = false;
      if (go) {
        haptic(15);
        setRefreshing(true);
        setPull(60);
        setTimeout(() => location.reload(), 350);
      } else {
        setPull(0);
      }
    };
    const onScroll = () => { if (tracking && pulling) return; if (tracking) tracking = false; };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [active]);

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

      {(pull > 0 || refreshing) && (
        <div className="bn-ptr" style={{ transform: `translate(-50%, ${pull - 56}px)`, opacity: Math.min(1, pull / 50) }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={36} height={36} className={refreshing ? "bn-ptr-spin" : ""} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
        </div>
      )}
    </>
  );
}
