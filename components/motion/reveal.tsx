"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children the first time they scroll into view.
 *
 * Content is visible in the server HTML and with JavaScript off. Only after mount, and only for blocks that are
 * still below the fold, is it hidden and then revealed, so nothing is ever stuck invisible.
 * With "reduce motion" turned on in the device settings it never hides anything.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  /** Milliseconds to wait once visible, for staggering a row of cards. */
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"visible" | "armed" | "shown">("visible");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) return; // already on screen: leave it alone
    setState("armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = state === "armed" ? "bn-reveal bn-reveal-armed" : state === "shown" ? "bn-reveal bn-reveal-in" : "bn-reveal-idle";
  return (
    <Tag ref={ref} className={`${cls} ${className}`.trim()} style={{ ...style, ["--bn-delay" as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
}
