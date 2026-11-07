"use client";

import { useEffect, useState } from "react";

/**
 * A word that swaps through a list, sliding up and out as the next one slides in.
 * All words sit in one grid cell so the line never changes width mid-sentence.
 * With "reduce motion" on, or a single word, it just shows the first one.
 */
export function RotatingWord({ words, intervalMs = 2400 }: { words: readonly string[]; intervalMs?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), intervalMs);
    return () => window.clearInterval(id);
  }, [words, intervalMs]);

  return (
    <span className="bn-rotor">
      {words.map((w, idx) => (
        <span key={w} className="bn-rotor-item" data-state={idx === i ? "on" : idx === (i - 1 + words.length) % words.length ? "out" : "off"} aria-hidden={idx !== i}>
          {w}
        </span>
      ))}
    </span>
  );
}
