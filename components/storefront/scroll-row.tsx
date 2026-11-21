"use client";

import { useRef, type ReactNode } from "react";

/** A swipeable row (scroll-snap) with working previous/next arrows. Children are the slides. */
export function ScrollRow({ children, label = "Items" }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const by = (d: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: d * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="bn-scrollrow" role="region" aria-label={label}>
      <div className="bn-scrollrow-track" ref={ref} tabIndex={0}>{children}</div>
      <button type="button" className="bn-scrollrow-btn prev" aria-label="Previous" onClick={() => by(-1)}>‹</button>
      <button type="button" className="bn-scrollrow-btn next" aria-label="Next" onClick={() => by(1)}>›</button>
    </div>
  );
}
