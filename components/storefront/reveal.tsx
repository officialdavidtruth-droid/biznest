"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/**
 * Wraps any section in a subtle fade+rise-in animation the first time it
 * scrolls into view. Pure CSS transition driven by IntersectionObserver —
 * no animation library, so it works inside every existing template without
 * new dependencies. Respects prefers-reduced-motion.
 */
export function Reveal({
  children,
  delayMs = 0,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  delayMs?: number;
  style?: CSSProperties;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Component = Tag;
  return (
    <Component
      ref={ref as never}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(.22,.61,.36,1) ${delayMs}ms, transform 0.7s cubic-bezier(.22,.61,.36,1) ${delayMs}ms`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
