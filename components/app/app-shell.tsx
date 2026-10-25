"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SPLASH_KEY = "bn-splash-shown";

function inApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("BizNestApp");
}

function scrollableAncestorAtTop(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node !== document.body && node !== document.documentElement) {
    const s = getComputedStyle(node);
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node.scrollTop <= 0;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement?.scrollTop ?? 0) <= 0;
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

  // Pull to refresh.
  useEffect(() => {
    if (!active) return;
    let startY = 0;
    let tracking = false;
    let dist = 0;
    const MAX = 110;
    const THRESHOLD = 80;
    const start = (e: TouchEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input,textarea,select,[data-no-pull]")) return;
      if (!scrollableAncestorAtTop(e.target)) return;
      startY = e.touches[0].clientY;
      tracking = true;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { dist = 0; setPull(0); return; }
      dist = Math.min(MAX, dy * 0.5);
      setPull(dist);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (dist >= THRESHOLD * 0.5 + 10) {
        haptic(15);
        setRefreshing(true);
        setPull(60);
        setTimeout(() => location.reload(), 350);
      } else {
        setPull(0);
      }
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
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
