"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a number up when it scrolls into view. Pass the final text ("1,250+", "12+", "2");
 * the digits animate and any prefix or suffix stays. The final text is what the server renders,
 * and what screen readers read, so nothing depends on the animation running.
 */
export function CountUp({ value, durationMs = 1400 }: { value: string; durationMs?: number }) {
  const match = value.match(/^(\D*)([\d,]+)(.*)$/);
  const target = match ? Number(match[2].replace(/,/g, "")) : NaN;
  const [shown, setShown] = useState<number | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(target) || target <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    setShown(0);
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
        else setShown(null);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, durationMs]);

  if (!match) return <>{value}</>;
  const text = shown === null ? value : `${match[1]}${shown.toLocaleString("en-NG")}${match[3]}`;
  return (
    <span ref={ref} aria-label={value} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span aria-hidden>{text}</span>
    </span>
  );
}
