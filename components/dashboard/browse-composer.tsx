"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, ImagePlus, Minus, Plus, Smile, Scissors, Trash2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { createBrowsePost } from "@/lib/actions/browse-vendor";
import { BROWSE_CAPTION_MAX, BROWSE_MAX_IMAGES, HASHTAG_SUGGESTIONS, STICKER_CHOICES, type Sticker } from "@/lib/browse";
import { BROWSE_VIDEO_MAX_SECONDS, BROWSE_VIDEO_TYPES, adjustTrim, videoErrorFor } from "@/lib/browse-video";
import { uploadBrowseImage, uploadBrowseVideo } from "@/components/dashboard/browse-upload";
import { bakePhotoCover, bakeVideoCover } from "@/components/dashboard/browse-bake";

type Tagged = { id: string; name: string };
type Step = "pick" | "edit" | "details";
type Tool = "trim" | "cover" | "stickers";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const btn = "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60";
const tabBtn = (on: boolean) => `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "border"}`;

function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

/** Full-screen "new post" flow: pick from the gallery, edit (trim, cover, stickers), then caption, hashtags and tagging. */
export function BrowseComposer({ slug, products, services, unlimited, onClose }: { slug: string; products: Tagged[]; services: Tagged[]; unlimited: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [files, setFiles] = useState<File[]>([]);
  const [isVideo, setIsVideo] = useState(false);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const [duration, setDuration] = useState<number | null>(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [coverRel, setCoverRel] = useState(0);
  const [cur, setCur] = useState(0);
  const [tool, setTool] = useState<Tool>("cover");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState(""); // "product:<id>" | "service:<id>"
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [busy, onClose]);

  async function pick(list: FileList | null) {
    setError("");
    const all = Array.from(list ?? []);
    const vid = all.find((f) => f.type.startsWith("video/"));
    if (vid) {
      const problem = videoErrorFor(vid, null, true);
      if (problem) { setError(problem); return; }
      const url = URL.createObjectURL(vid);
      const d = await readDuration(url);
      URL.revokeObjectURL(url);
      setFiles([vid]); setIsVideo(true); setDuration(d);
      const end = d == null ? 0 : unlimited ? d : Math.min(d, BROWSE_VIDEO_MAX_SECONDS);
      setTrim({ start: 0, end }); setCoverRel(0); setTool(d != null && d > BROWSE_VIDEO_MAX_SECONDS && !unlimited ? "trim" : "cover");
    } else {
      const imgs = all.filter((f) => f.type.startsWith("image/")).slice(0, BROWSE_MAX_IMAGES);
      if (imgs.length === 0) { setError("Choose photos or a video."); return; }
      setFiles(imgs); setIsVideo(false); setDuration(null); setTool("cover");
    }
    setStickers([]); setSel(null); setCur(0); setStep("edit");
    if (picker.current) picker.current.value = "";
  }

  // Keep the preview inside the chosen range.
  function onTime() {
    const v = video.current; if (!v || !isVideo || tool === "cover") return;
    if (v.currentTime >= trim.end - 0.05 || v.currentTime < trim.start - 0.2) v.currentTime = trim.start;
  }
  function moveTrim(which: "start" | "end", value: number) {
    if (duration == null) return;
    const next = adjustTrim(trim, which, value, duration, unlimited);
    setTrim(next);
    setCoverRel((c) => Math.min(c, Math.max(0, next.end - next.start - 0.1)));
    if (video.current) { video.current.pause(); video.current.currentTime = which === "start" ? next.start : Math.max(next.start, next.end - 0.3); }
  }
  function seekCover(rel: number) {
    setCoverRel(rel);
    if (video.current) { video.current.pause(); video.current.currentTime = trim.start + rel; }
  }
  function makeCover(i: number) {
    if (i === 0) return;
    setFiles((f) => { const n = [...f]; const [m] = n.splice(i, 1); n.unshift(m); return n; });
    setCur(0);
  }

  function addSticker(e: string) {
    if (stickers.length >= 8) return;
    setStickers((s) => [...s, { e, x: 50, y: 50, s: 1 }]); setSel(stickers.length);
  }
  function dragMove(ev: React.PointerEvent) {
    if (drag.current == null || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
    const i = drag.current;
    setStickers((s) => s.map((st, k) => (k === i ? { ...st, x, y } : st)));
  }
  const resize = (d: number) => sel != null && setStickers((s) => s.map((st, k) => (k === sel ? { ...st, s: Math.min(4, Math.max(0.5, +(st.s + d).toFixed(2))) } : st)));
  const removeSticker = () => { if (sel == null) return; setStickers((s) => s.filter((_, k) => k !== sel)); setSel(null); };

  function addTag(t: string) { setCaption((c) => (c.includes(`#${t}`) || c.length + t.length + 2 > BROWSE_CAPTION_MAX ? c : `${c}${c && !/\s$/.test(c) ? " " : ""}#${t} `)); }

  async function share() {
    setError(""); setBusy(true);
    try {
      let images: string[] = []; let videoUrl: string | null = null;
      if (isVideo) {
        setProgress(0);
        videoUrl = await uploadBrowseVideo(slug, files[0], duration != null ? { start: trim.start, end: trim.end } : null, setProgress);
        // Burn the stickers into the cover frame so link previews and the paused poster show them.
        if (stickers.length > 0) images = [await uploadBrowseImage(await bakeVideoCover(urls[0], trim.start + coverRel, stickers))];
      } else {
        for (let i = 0; i < files.length; i++) {
          setProgress(Math.round((i / files.length) * 100));
          images.push(await uploadBrowseImage(i === 0 && stickers.length > 0 ? await bakePhotoCover(files[0], stickers) : files[i]));
        }
      }
      setProgress(null);
      const [kind, id] = tag.split(":");
      const r = await createBrowsePost(slug, { caption, images, videoUrl, coverTime: coverRel, stickers: isVideo ? stickers : [], tagKind: kind === "service" ? "SERVICE" : "PRODUCT", productId: id || null });
      if (!r.success) { setError(r.error ?? "Couldn't post. Try again."); return; }
      toast.success("Posted to Browse.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const title = step === "pick" ? "New post" : step === "edit" ? "Edit" : "Details";
  const span = trim.end - trim.start;
  const canNext = files.length > 0 && (!isVideo || duration == null || span >= 0.5);

  return (
    <div role="dialog" aria-modal="true" aria-label="New post" className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6">
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b px-3 py-2.5">
          <button type="button" disabled={busy} aria-label={step === "pick" ? "Close" : "Back"} className="rounded-md p-2 hover:bg-muted disabled:opacity-50" onClick={() => (step === "pick" ? onClose() : setStep(step === "details" ? "edit" : "pick"))}>
            {step === "pick" ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold">{title}</h2>
          {step === "edit" && <button type="button" className="px-2 text-sm font-semibold text-primary disabled:opacity-50" disabled={!canNext} onClick={() => { video.current?.pause(); setStep("details"); }}>Next</button>}
          {step === "details" && <button type="button" className="px-2 text-sm font-semibold text-primary disabled:opacity-50" disabled={busy || (!caption.trim() && files.length === 0)} onClick={share}>{busy ? "Posting…" : "Share"}</button>}
          {step === "pick" && <span className="w-9" />}
        </header>

        <div className="flex-1 overflow-y-auto">
          {step === "pick" && (
            <div className="space-y-3 p-5">
              <button type="button" onClick={() => picker.current?.click()} className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-16 text-center hover:bg-muted">
                <ImagePlus className="h-10 w-10 text-muted-foreground" aria-hidden />
                <span className="text-sm font-semibold">Choose from your gallery</span>
                <span className="text-xs text-muted-foreground">Up to {BROWSE_MAX_IMAGES} photos, or one video{unlimited ? "" : ` (up to ${BROWSE_VIDEO_MAX_SECONDS} seconds)`}</span>
              </button>
              <input ref={picker} type="file" multiple accept={`image/*,${BROWSE_VIDEO_TYPES.join(",")}`} className="sr-only" onChange={(e) => void pick(e.target.files)} />
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {step === "edit" && files.length > 0 && (
            <div className="space-y-3 p-3">
              <div
                ref={stage}
                style={{ containerType: "inline-size" }}
                className="relative mx-auto aspect-[4/5] w-full max-w-sm touch-none select-none overflow-hidden rounded-2xl bg-black"
                onPointerMove={dragMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
                onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}
              >
                {isVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video ref={video} src={urls[0]} className="h-full w-full object-contain" playsInline muted loop={false} autoPlay={tool === "trim"} onTimeUpdate={onTime} onLoadedMetadata={() => { if (video.current) video.current.currentTime = trim.start + coverRel; }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[cur]} alt="" className="h-full w-full object-cover" draggable={false} />
                )}
                {(isVideo || cur === 0) && stickers.map((st, i) => (
                  <button
                    key={i} type="button" aria-label={`Sticker ${st.e}`}
                    onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; setSel(i); }}
                    style={{ left: `${st.x}%`, top: `${st.y}%`, fontSize: `${st.s * 9.4}cqw`, lineHeight: 1 }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-lg p-1 ${sel === i ? "ring-2 ring-white/80" : ""}`}
                  >{st.e}</button>
                ))}
              </div>

              {!isVideo && files.length > 1 && (
                <div className="flex justify-center gap-2">
                  {urls.map((u, i) => (
                    <button key={u} type="button" onClick={() => setCur(i)} aria-label={`Photo ${i + 1}${i === 0 ? ", cover" : ""}`} className={`relative h-14 w-12 overflow-hidden rounded-lg ${cur === i ? "ring-2 ring-primary" : "opacity-70"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] font-semibold text-white">Cover</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {isVideo && duration != null && <button type="button" className={tabBtn(tool === "trim")} onClick={() => { setTool("trim"); video.current?.play().catch(() => {}); }}><Scissors className="h-4 w-4" aria-hidden />Trim</button>}
                <button type="button" className={tabBtn(tool === "cover")} onClick={() => { setTool("cover"); video.current?.pause(); }}><ImageIcon className="h-4 w-4" aria-hidden />Cover</button>
                <button type="button" className={tabBtn(tool === "stickers")} onClick={() => { setTool("stickers"); video.current?.pause(); }}><Smile className="h-4 w-4" aria-hidden />Stickers</button>
              </div>

              {tool === "trim" && isVideo && duration != null && (
                <div className="space-y-3 rounded-xl border p-3">
                  <p className="text-xs">Clip: <b>{fmt(trim.start)}</b> to <b>{fmt(trim.end)}</b> · {fmt(span)} long{!unlimited && ` (max ${BROWSE_VIDEO_MAX_SECONDS} seconds)`}</p>
                  <label className="block text-xs">Start
                    <input type="range" className="mt-1 w-full" min={0} max={duration} step={0.1} value={trim.start} onChange={(e) => moveTrim("start", +e.target.value)} />
                  </label>
                  <label className="block text-xs">End
                    <input type="range" className="mt-1 w-full" min={0} max={duration} step={0.1} value={trim.end} onChange={(e) => moveTrim("end", +e.target.value)} />
                  </label>
                  {!unlimited && duration > BROWSE_VIDEO_MAX_SECONDS && <p className="text-xs text-muted-foreground">This video is {fmt(duration)}. Pick the {BROWSE_VIDEO_MAX_SECONDS} seconds you want to keep.</p>}
                </div>
              )}

              {tool === "cover" && (
                <div className="space-y-2 rounded-xl border p-3">
                  {isVideo ? (
                    <label className="block text-xs">Pick the cover frame
                      <input type="range" className="mt-1 w-full" min={0} max={Math.max(0.1, span - 0.1)} step={0.1} value={coverRel} onChange={(e) => seekCover(+e.target.value)} />
                    </label>
                  ) : files.length > 1 ? (
                    <button type="button" className="w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={cur === 0} onClick={() => makeCover(cur)}>{cur === 0 ? "This photo is the cover" : "Make this photo the cover"}</button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Your photo is the cover.</p>
                  )}
                </div>
              )}

              {tool === "stickers" && (
                <div className="space-y-2 rounded-xl border p-3">
                  {!isVideo && cur !== 0 && <p className="text-xs text-muted-foreground">Stickers go on the cover photo. Select the first photo to place them.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {STICKER_CHOICES.map((e) => <button key={e} type="button" onClick={() => addSticker(e)} disabled={!isVideo && cur !== 0} aria-label={`Add ${e}`} className="rounded-lg border px-2 py-1 text-xl hover:bg-muted disabled:opacity-40">{e}</button>)}
                  </div>
                  <p className="text-xs text-muted-foreground">Drag a sticker to move it. It is saved into your cover picture.</p>
                  {sel != null && stickers[sel] && (
                    <div className="flex gap-2">
                      <button type="button" className="rounded-lg border p-2" aria-label="Smaller" onClick={() => resize(-0.25)}><Minus className="h-4 w-4" /></button>
                      <button type="button" className="rounded-lg border p-2" aria-label="Larger" onClick={() => resize(0.25)}><Plus className="h-4 w-4" /></button>
                      <button type="button" className="ml-auto flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-red-600" onClick={removeSticker}><Trash2 className="h-4 w-4" />Remove</button>
                    </div>
                  )}
                </div>
              )}
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {step === "details" && (
            <div className="space-y-4 p-4">
              <div className="flex gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-black">
                  {isVideo ? <Film className="absolute inset-0 m-auto h-6 w-6 text-white/80" aria-hidden /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={urls[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <textarea className="h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm" maxLength={BROWSE_CAPTION_MAX} placeholder="Write a caption…" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{caption.length}/{BROWSE_CAPTION_MAX}</p>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold">Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {HASHTAG_SUGGESTIONS.map((t) => <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">#{t}</button>)}
                </div>
              </div>

              <label className="block text-xs font-semibold">Tag a product or service
                <select className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">None</option>
                  {products.length > 0 && <optgroup label="Products">{products.map((p) => <option key={p.id} value={`product:${p.id}`}>{p.name}</option>)}</optgroup>}
                  {services.length > 0 && <optgroup label="Services">{services.map((p) => <option key={p.id} value={`service:${p.id}`}>{p.name}</option>)}</optgroup>}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">Tagged items show a buy or book button on your post.</p>

              {progress !== null && (
                <div role="status" aria-live="polite">
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">Uploading… {progress}%</p>
                </div>
              )}
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
              <button type="button" className={`${btn} w-full sm:hidden`} disabled={busy} onClick={share}>{busy ? "Posting…" : "Share"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
