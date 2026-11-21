"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A real photo slideshow for a hero. Sits behind the hero text (the hero keeps its own first image as a fallback),
 * cross-fades every few seconds, pauses while the visitor hovers/touches or the tab is hidden, never autoplays for
 * visitors who ask for reduced motion, and has arrows + dots that actually work. With fewer than two photos it
 * renders nothing, so there are no controls for something that can't rotate.
 */
export function HeroSlides({ images, overlay = "linear-gradient(90deg,rgba(0,0,0,.65),rgba(0,0,0,.06))", interval = 6000 }: { images: string[]; overlay?: string; interval?: number }) {
  const list = Array.from(new Set(images.filter(Boolean))).slice(0, 6);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const n = list.length;

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => {
      if (reduced.current || document.hidden) return;
      setI((x) => (x + 1) % n);
    }, interval);
    return () => clearInterval(t);
  }, [n, paused, interval]);

  if (n < 2) return null;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <div className="gv-slides" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}>
      {list.map((src, k) => (
        <div key={src} className="gv-slide" aria-hidden={k !== i} style={{ opacity: k === i ? 1 : 0, backgroundImage: `${overlay},url(${src})` }} />
      ))}
      <div className="gv-dots" role="group" aria-label="Hero photos">
        <button type="button" aria-label="Previous photo" onClick={() => go(-1)}>‹</button>
        {list.map((_, k) => (
          <button key={k} type="button" aria-label={`Photo ${k + 1} of ${n}`} aria-current={k === i} className={k === i ? "on" : ""} onClick={() => setI(k)} />
        ))}
        <button type="button" aria-label="Next photo" onClick={() => go(1)}>›</button>
      </div>
    </div>
  );
}
