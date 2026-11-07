"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { albumCategories, displayImageUrl, portfolioPath } from "@/lib/portfolio";

export type PortfolioAlbumView = {
  id: string; title: string; slug: string; category: string | null; description: string | null; coverUrl: string | null;
  images: { id: string; url: string; caption: string | null }[]; imageCount: number;
};

const CSS = `
.pf-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}
.pf-chip{border:1px solid #10243b26;background:transparent;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;color:inherit}
.pf-chip[aria-pressed="true"]{color:#fff}
.pf-chip:focus-visible,.pf-card:focus-visible,.pf-tile:focus-visible,.pf-lb button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.pf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.pf-card{display:block;color:inherit;text-decoration:none}
.pf-cover{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:14px;background:#e7edf4}
.pf-cover img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.pf-card:hover .pf-cover img{transform:scale(1.04)}
.pf-card h3{margin:12px 0 2px;font-size:18px;line-height:1.25}
.pf-card p{margin:0;font-size:13px;opacity:.7}
.pf-masonry{columns:3;column-gap:14px}
.pf-tile{display:block;width:100%;margin:0 0 14px;padding:0;border:0;background:#e7edf4;border-radius:10px;overflow:hidden;cursor:zoom-in;break-inside:avoid}
.pf-tile img{display:block;width:100%;height:auto}
.pf-back{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;text-decoration:none;color:inherit;margin-bottom:18px}
.pf-lb{position:fixed;inset:0;z-index:80;background:rgba(8,10,14,.94);display:flex;align-items:center;justify-content:center;padding:16px}
.pf-lb img{max-width:min(94vw,1400px);max-height:82vh;object-fit:contain;border-radius:6px}
.pf-lb figcaption{margin-top:12px;text-align:center;color:#e8edf3;font-size:14px;min-height:20px}
.pf-lb button{position:absolute;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.pf-lb .pf-x{top:16px;right:16px}.pf-lb .pf-prev{left:16px;top:50%}.pf-lb .pf-next{right:16px;top:50%}
.pf-count{position:absolute;top:26px;left:20px;color:#cfd6df;font-size:13px}
@media(max-width:900px){.pf-grid{grid-template-columns:repeat(2,1fr)}.pf-masonry{columns:2}}
@media(max-width:560px){.pf-grid{grid-template-columns:1fr}.pf-masonry{columns:1}.pf-lb .pf-prev{left:8px}.pf-lb .pf-next{right:8px}}
@media(prefers-reduced-motion:reduce){.pf-cover img{transition:none}.pf-card:hover .pf-cover img{transform:none}}
`;

/** The album cards on /portfolio, with category filter chips when there is more than one category. */
export function AlbumGrid({ slug, albums, accent }: { slug: string; albums: PortfolioAlbumView[]; accent: string }) {
  const cats = albumCategories(albums);
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? albums.filter((a) => a.category === active) : albums;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {cats.length > 1 && (
        <div className="pf-chips" role="group" aria-label="Filter albums by category">
          <button className="pf-chip" aria-pressed={active === null} onClick={() => setActive(null)} style={active === null ? { background: accent, borderColor: accent } : undefined}>All</button>
          {cats.map((c) => (
            <button key={c} className="pf-chip" aria-pressed={active === c} onClick={() => setActive(c)} style={active === c ? { background: accent, borderColor: accent } : undefined}>{c}</button>
          ))}
        </div>
      )}
      <div className="pf-grid">
        {shown.map((a, i) => (
          <Link key={a.id} href={portfolioPath(slug, a.slug)} className="pf-card">
            <div className="pf-cover">
              {a.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayImageUrl(a.coverUrl, 800)} alt={`${a.title} cover`} loading={i < 3 ? "eager" : "lazy"} />
              )}
            </div>
            <h3>{a.title}</h3>
            <p>{[a.category, `${a.imageCount} photo${a.imageCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

/** One album: a masonry of photos that open in a full-screen viewer (arrow keys, Escape, swipe-free buttons). */
export function AlbumGallery({ slug, album }: { slug: string; album: PortfolioAlbumView }) {
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const total = album.images.length;

  const close = useCallback(() => { setIndex(null); opener.current?.focus(); }, []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + total) % total)), [total]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, close, step]);

  const current = index === null ? null : album.images[index];
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Link href={portfolioPath(slug)} className="pf-back"><ArrowLeft size={16} /> All albums</Link>
      {album.description && <p style={{ maxWidth: 640, margin: "0 0 24px", opacity: 0.8, lineHeight: 1.6 }}>{album.description}</p>}
      <div className="pf-masonry">
        {album.images.map((img, i) => (
          <button key={img.id} className="pf-tile" onClick={(e) => { opener.current = e.currentTarget; setIndex(i); }} aria-label={img.caption ? `Open photo: ${img.caption}` : `Open photo ${i + 1} of ${total}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayImageUrl(img.url, 800)} alt={img.caption || `${album.title} photo ${i + 1}`} loading={i < 6 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>
      {current && (
        <div className="pf-lb" role="dialog" aria-modal="true" aria-label={`${album.title} photo viewer`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <span className="pf-count" aria-live="polite">{(index ?? 0) + 1} / {total}</span>
          <button className="pf-x" onClick={close} aria-label="Close viewer" autoFocus><X size={20} /></button>
          {total > 1 && <button className="pf-prev" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft size={22} /></button>}
          <figure style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayImageUrl(current.url, 1800)} alt={current.caption || `${album.title} photo ${(index ?? 0) + 1}`} />
            <figcaption>{current.caption}</figcaption>
          </figure>
          {total > 1 && <button className="pf-next" onClick={() => step(1)} aria-label="Next photo"><ChevronRight size={22} /></button>}
        </div>
      )}
    </>
  );
}
