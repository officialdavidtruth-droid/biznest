"use client";

import { useState, type ReactNode } from "react";
import type { HeroMedia } from "@/lib/storefront/hero-media";

/** Poster with a play button that really plays the vendor's video (file, YouTube or Vimeo) in place. */
export function PlayVideo({ media, className, children, icon }: { media: HeroMedia; className?: string; children: ReactNode; icon: ReactNode }) {
  const [on, setOn] = useState(false);
  if (media.type !== "file-video" && media.type !== "youtube" && media.type !== "vimeo") return null;
  if (on) {
    return (
      <section className={className} style={{ padding: 0, background: "#000" }}>
        {media.type === "file-video" ? (
          <video src={media.url} controls autoPlay playsInline style={{ width: "100%", maxHeight: 560, display: "block" }} />
        ) : (
          <iframe src={media.embedUrl.replace("autoplay=1&mute=1", "autoplay=1&mute=0").replace("autoplay=1&muted=1", "autoplay=1&muted=0")} title="Hotel video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{ width: "100%", aspectRatio: "16/9", maxHeight: 560, border: 0, display: "block" }} />
        )}
      </section>
    );
  }
  return (
    <section className={className}>
      {children}
      <button type="button" aria-label="Play video" onClick={() => setOn(true)} style={{ border: 0, cursor: "pointer", width: 64, height: 64, borderRadius: "50%", background: "#b58a69", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</button>
    </section>
  );
}
