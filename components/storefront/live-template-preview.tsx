"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a real demo storefront (at real desktop width) scaled down to fit
 * whatever container it's placed in, measured via ResizeObserver. Used
 * anywhere we need to show what a template actually looks like — the
 * template gallery card, the public /templates page — instead of a static
 * screenshot or a redrawn mockup of the hero.
 */
const SOURCE_WIDTH = 1400;
const SOURCE_HEIGHT = 1000;

export function LiveTemplatePreview({ slug, title }: { slug: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SOURCE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none h-full w-full overflow-hidden">
      {scale > 0 && (
        <div
          style={{
            width: SOURCE_WIDTH,
            height: SOURCE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <iframe
            src={`/store/${slug}`}
            title={title}
            loading="lazy"
            tabIndex={-1}
            style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT, border: 0 }}
          />
        </div>
      )}
    </div>
  );
}
