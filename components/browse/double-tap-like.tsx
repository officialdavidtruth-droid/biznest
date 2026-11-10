"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Heart } from "lucide-react";

const WINDOW_MS = 260;

/**
 * Double-tap to like. A single tap still does what it always did (open the post, play or pause),
 * just a fraction of a second later, once we know a second tap isn't coming. Keyboard and
 * ctrl/cmd/shift clicks skip the wait and behave normally.
 */
export function useDoubleTapLike(onDouble: () => void): {
  tap: (e: MouseEvent, onSingle: () => void) => void;
  heart: ReactNode;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onDouble);
  latest.current = onDouble;
  const [burst, setBurst] = useState(0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tap = useCallback((e: MouseEvent, onSingle: () => void) => {
    if (e.detail === 0 || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { onSingle(); return; }
    e.preventDefault();
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      latest.current();
      setBurst((n) => n + 1);
      return;
    }
    timer.current = setTimeout(() => { timer.current = null; onSingle(); }, WINDOW_MS);
  }, []);

  const heart = burst > 0 ? (
    <span key={burst} className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden>
      <style>{`@keyframes bn-heart-pop{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.15);opacity:1}55%{transform:scale(1);opacity:1}100%{transform:scale(1.25);opacity:0}}@media (prefers-reduced-motion:reduce){.bn-heart{animation-duration:.01ms!important}}`}</style>
      <Heart className="bn-heart h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-[0_4px_14px_rgba(0,0,0,.45)]" style={{ animation: "bn-heart-pop 800ms ease-out forwards" }} />
    </span>
  ) : null;

  return { tap, heart };
}
