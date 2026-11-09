"use client";

import { useEffect, useRef, useState } from "react";

const SOURCE_WIDTH = 1280;
const SOURCE_HEIGHT = 800;

/**
 * The real template preview, scaled down to fit its card. The frame is only mounted once the card is near the
 * screen, so a page with dozens of templates does not render dozens of storefronts at once.
 */
export function LazyPreviewFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SOURCE_WIDTH));
    resize.observe(el);
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); seen.disconnect(); }
    }, { rootMargin: "300px" });
    seen.observe(el);
    return () => { resize.disconnect(); seen.disconnect(); };
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
      {visible && scale > 0 && (
        <iframe
          src={src}
          title={title}
          tabIndex={-1}
          scrolling="no"
          style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
      )}
    </div>
  );
}
