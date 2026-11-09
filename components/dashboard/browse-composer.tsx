"use client";

import { pickNativeMedia } from "@/lib/native";
import { clearDraft, loadDraft, saveDraft, type BrowseDraft } from "@/lib/browse-draft";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, ChevronRight, Hash, Image as ImageIcon, MapPin, Minus, Pause, Play, Plus, Scissors, Smile, Sparkles, Tag, Trash2, Type, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { createBrowsePost } from "@/lib/actions/browse-vendor";
import { BROWSE_CAPTION_MAX, BROWSE_LOCATION_MAX, BROWSE_MAX_IMAGES, BROWSE_MAX_STICKERS, BROWSE_MAX_TAGS, BROWSE_TEXT_MAX, HASHTAG_SUGGESTIONS, STICKER_CHOICES, type Sticker } from "@/lib/browse";
import { BROWSE_VIDEO_MAX_SECONDS, adjustTrim, videoErrorFor } from "@/lib/browse-video";
import { uploadBrowseImage, uploadBrowseVideo } from "@/components/dashboard/browse-upload";
import { bakePhotoCover, bakeVideoCover, readVideoLength, videoFrames } from "@/components/dashboard/browse-bake";

type Tagged = { id: string; name: string };
type Person = { kind: "store" | "user"; id: string; name: string; sub: string; logoUrl: string | null };
type Screen = "pick" | "edit" | "details" | "cover";
type Sheet = "trim" | "stickers" | "text" | null;

const ACCENT = "bg-[#F5B82E] text-[#14301A]";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const topPad = "pt-[max(env(safe-area-inset-top),1rem)] max-sm:pt-[max(env(safe-area-inset-top),3rem)]";
const botPad = "pb-[max(env(safe-area-inset-bottom),1.25rem)]";
const field = "text-white placeholder:text-white/50 caret-[#F5B82E] [color-scheme:dark]";
const ghostBtn = "rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";

/** The picture area. Emoji and text items sit on top and can be dragged; sizes are a share of the width so they match the feed. */
function Stage({ children, items, setItems, sel, setSel, interactive, className = "" }: {
  children: React.ReactNode; items: Sticker[]; setItems: (f: (s: Sticker[]) => Sticker[]) => void; sel: number | null; setSel: (i: number | null) => void; interactive: boolean; className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  function move(ev: React.PointerEvent) {
    if (drag.current == null || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
    const i = drag.current;
    setItems((s) => s.map((it, k) => (k === i ? { ...it, x, y } : it)));
  }
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <div
        ref={box} style={{ containerType: "inline-size" }}
        className="absolute inset-0 touch-none select-none"
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}
      >
        {children}
        {items.map((it, i) => {
          const style = { left: `${it.x}%`, top: `${it.y}%`, fontSize: `${it.s * (it.k === "text" ? 5.5 : 9.4)}cqw`, lineHeight: it.k === "text" ? 1.5 : 1 } as const;
          const look = it.k === "text" ? "whitespace-nowrap rounded-[0.4em] bg-black/55 px-[0.4em] font-bold text-white" : "";
          return interactive ? (
            <button
              key={i} type="button" aria-label={`Move ${it.e}`} style={style}
              onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; setSel(i); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none ${look} ${sel === i ? "outline outline-2 outline-white/80" : ""}`}
            >{it.e}</button>
          ) : (
            <span key={i} style={style} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${look}`}>{it.e}</span>
          );
        })}
      </div>
    </div>
  );
}

/** Full-screen "new post" flow: gallery, edit, details (caption, hashtags, people, product or service, location), cover. */
type ComposerProps = { slug: string; products: Tagged[]; services: Tagged[]; unlimited: boolean; onClose: () => void };

/** Rendered straight into <body> so it always covers the whole screen, whatever page it was opened from. */
export function BrowseComposer(props: ComposerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(<ComposerInner {...props} />, document.body) : null;
}

function ComposerInner({ slug, products, services, unlimited, onClose }: ComposerProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("pick");
  const [files, setFiles] = useState<File[]>([]);
  const [isVideo, setIsVideo] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { const u = files.map((f) => URL.createObjectURL(f)); setUrls(u); return () => u.forEach((x) => URL.revokeObjectURL(x)); }, [files]);

  const [duration, setDuration] = useState<number | null>(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [coverRel, setCoverRel] = useState(0);
  const [customCover, setCustomCover] = useState<File | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  useEffect(() => { if (!customCover) { setCustomUrl(null); return; } const u = URL.createObjectURL(customCover); setCustomUrl(u); return () => URL.revokeObjectURL(u); }, [customCover]);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoProblem, setVideoProblem] = useState<number | null>(null);
  const [items, setItems] = useState<Sticker[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [textDraft, setTextDraft] = useState("");
  const [frames, setFrames] = useState<string[]>([]);
  const [thumb, setThumb] = useState<string | null>(null);
  const [coverTab, setCoverTab] = useState<"cover" | "grid">("cover");
  const coverSnap = useRef<{ coverRel: number; customCover: File | null; items: Sticker[] } | null>(null);

  const [caption, setCaption] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState(""); // "product:<id>" | "service:<id>"
  const [location, setLocation] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [ai, setAi] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<BrowseDraft | null>(null);
  const [askClose, setAskClose] = useState(false);

  useEffect(() => { let alive = true; void loadDraft(slug).then((d) => { if (alive) setSaved(d); }); return () => { alive = false; }; }, [slug]);

  const hasWork = files.length > 0 || caption.trim().length > 0;
  function requestClose() { if (busy) return; if (hasWork) setAskClose(true); else onClose(); }
  async function keepDraft() {
    const ok = await saveDraft(slug, { files, isVideo, duration, trim, coverRel, customCover, items, caption, tag, location, ai, people });
    if (ok) toast.success("Draft saved. Open New post to continue."); else toast.error("Couldn't save the draft on this device.");
    onClose();
  }
  async function discardDraft() { await clearDraft(slug); setSaved(null); onClose(); }
  function resumeDraft() {
    if (!saved) return;
    setFiles(saved.files); setIsVideo(saved.isVideo); setDuration(saved.duration); setTrim(saved.trim); setCoverRel(saved.coverRel);
    setCustomCover(saved.customCover); setItems(saved.items); setCaption(saved.caption); setTag(saved.tag); setLocation(saved.location);
    setAi(saved.ai); setPeople(saved.people); setCur(0); setVideoProblem(null); setSaved(null);
  }

  const mainVideo = useRef<HTMLVideoElement>(null);
  const coverVideo = useRef<HTMLVideoElement>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const galleryOne = useRef<HTMLInputElement>(null);
  const galleryMany = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const coverPicker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) requestClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, onClose, hasWork]);

  // A small thumbnail for the picked video, and the filmstrip for the cover screen.
  useEffect(() => {
    if (!isVideo || !urls[0]) { setThumb(null); return; }
    let alive = true;
    videoFrames(urls[0], 0, 0, 1).then((f) => { if (alive) setThumb(f[0] ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [isVideo, urls]);
  useEffect(() => {
    if (screen !== "cover" || !isVideo || !urls[0]) return;
    let alive = true;
    videoFrames(urls[0], trim.start, Math.max(trim.start + 0.1, trim.end), 8).then((f) => { if (alive) setFrames(f); }).catch(() => {});
    return () => { alive = false; };
  }, [screen, isVideo, urls, trim.start, trim.end]);
  useEffect(() => {
    if (screen === "cover" && coverVideo.current) coverVideo.current.currentTime = trim.start + coverRel;
  }, [screen, coverRel, trim.start, coverTab]);

  // Inside the BizNest Android app this opens the phone's own gallery; elsewhere it falls back to the file picker.
  async function openGallery(multiple: boolean) {
    const picked = await pickNativeMedia(multiple ? 10 : 1);
    if (picked) { if (picked.length) await addFiles(picked); return; }
    (multiple ? galleryMany : galleryOne).current?.click();
  }

  async function addFiles(list: ArrayLike<File> | null) {
    setError("");
    const all = Array.from(list ?? []);
    if (all.length === 0) return;
    const vid = all.find((f) => f.type.startsWith("video/"));
    if (vid) {
      const problem = videoErrorFor(vid, null, true);
      if (problem) { setError(problem); return; }
      const url = URL.createObjectURL(vid);
      const d = await readVideoLength(url);
      URL.revokeObjectURL(url);
      setVideoProblem(null); setFiles([vid]); setIsVideo(true); setDuration(d); setCur(0); setItems([]); setSel(null); setCustomCover(null);
      const end = d == null ? 0 : unlimited ? d : Math.min(d, BROWSE_VIDEO_MAX_SECONDS);
      setTrim({ start: 0, end }); setCoverRel(0);
    } else {
      const imgs = all.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) { setError("Choose photos or a video."); return; }
      const keep = isVideo ? [] : files;
      setFiles([...keep, ...imgs].slice(0, BROWSE_MAX_IMAGES)); setIsVideo(false); setDuration(null);
    }
    for (const r of [galleryOne, galleryMany, camera]) if (r.current) r.current.value = "";
  }
  function removeFile(i: number) {
    setFiles((f) => f.filter((_, k) => k !== i)); setCur(0);
    if (files.length <= 1) { setIsVideo(false); setDuration(null); setItems([]); }
  }

  function onTime() {
    const v = mainVideo.current; if (!v || !isVideo) return;
    if (v.currentTime >= trim.end - 0.05 || v.currentTime < trim.start - 0.2) v.currentTime = trim.start;
  }
  function moveTrim(which: "start" | "end", value: number) {
    if (duration == null) return;
    const next = adjustTrim(trim, which, value, duration, unlimited);
    setTrim(next);
    setCoverRel((c) => Math.min(c, Math.max(0, next.end - next.start - 0.1)));
    if (mainVideo.current) { mainVideo.current.pause(); mainVideo.current.currentTime = which === "start" ? next.start : Math.max(next.start, next.end - 0.3); }
  }
  const span = trim.end - trim.start;
  function togglePlay() { const v = mainVideo.current; if (!v) return; if (v.paused) { if (v.currentTime >= trim.end - 0.1 || v.currentTime < trim.start) v.currentTime = trim.start; void v.play().catch(() => {}); } else v.pause(); }

  function addEmoji(e: string) { if (items.length >= BROWSE_MAX_STICKERS) return; setItems((s) => [...s, { e, x: 50, y: 50, s: 1 }]); setSel(items.length); setSheet(null); }
  function addText() {
    const t = textDraft.replace(/[<>]/g, "").trim().slice(0, BROWSE_TEXT_MAX);
    if (!t || items.length >= BROWSE_MAX_STICKERS) return;
    setItems((s) => [...s, { e: t, x: 50, y: 50, s: 1, k: "text" }]); setSel(items.length); setTextDraft(""); setSheet(null);
  }
  const resize = (d: number) => sel != null && setItems((s) => s.map((it, k) => (k === sel ? { ...it, s: Math.min(4, Math.max(0.5, +(it.s + d).toFixed(2))) } : it)));
  const removeItem = () => { if (sel == null) return; setItems((s) => s.filter((_, k) => k !== sel)); setSel(null); };
  function makeCover(i: number) {
    if (i === 0) return;
    setFiles((f) => { const n = [...f]; const [m] = n.splice(i, 1); n.unshift(m); return n; });
    setCur(0);
  }
  function openCover() {
    coverSnap.current = { coverRel, customCover, items };
    setCoverTab("cover"); setSheet(null); setSel(null); setScreen("cover");
  }
  function cancelCover() {
    const s = coverSnap.current;
    if (s) { setCoverRel(s.coverRel); setCustomCover(s.customCover); setItems(s.items); }
    setScreen("details");
  }

  async function share() {
    setError(""); setBusy(true);
    try {
      let images: string[] = []; let videoUrl: string | null = null;
      if (isVideo) {
        setProgress(0);
        videoUrl = await uploadBrowseVideo(slug, files[0], duration != null ? { start: trim.start, end: trim.end } : null, setProgress);
        // Burn the items into the cover so link previews and the paused poster show them.
        try {
          if (customCover) images = [await uploadBrowseImage(await bakePhotoCover(customCover, items))];
          else if (items.length > 0) images = [await uploadBrowseImage(await bakeVideoCover(urls[0], trim.start + coverRel, items))];
        } catch { images = []; /* the server makes a plain poster instead */ }
      } else {
        for (let i = 0; i < files.length; i++) {
          setProgress(Math.round((i / files.length) * 100));
          images.push(await uploadBrowseImage(i === 0 && items.length > 0 ? await bakePhotoCover(files[0], items) : files[i]));
        }
      }
      setProgress(null);
      const [kind, id] = tag.split(":");
      const r = await createBrowsePost(slug, {
        caption, images, videoUrl, coverTime: coverRel, stickers: isVideo ? items : [],
        tagKind: kind === "service" ? "SERVICE" : "PRODUCT", productId: id || null,
        tags: people.map((p) => ({ kind: p.kind, id: p.id })), location: location || null, aiGenerated: ai,
      });
      if (!r.success) { setError(r.error ?? "Couldn't post. Try again."); return; }
      toast.success("Posted to Browse.");
      void clearDraft(slug);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  /** The cover as a picture: a chosen camera-roll image, a video frame, or the first photo. */
  const coverMedia = (fit: "cover" | "contain") => customUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={customUrl} alt="" className="h-full w-full object-cover" draggable={false} />
    : isVideo
      // eslint-disable-next-line jsx-a11y/media-has-caption
      ? <video ref={coverVideo} src={urls[0]} muted playsInline preload="auto" className="h-full w-full object-contain" onLoadedMetadata={() => { if (coverVideo.current) coverVideo.current.currentTime = trim.start + coverRel; }} />
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={urls[0]} alt="" className="h-full w-full object-cover" draggable={false} />;

  const taggedLabel = tag ? [...products.map((p) => ({ ...p, k: "product" })), ...services.map((p) => ({ ...p, k: "service" }))].find((p) => `${p.k}:${p.id}` === tag)?.name : null;
  const canShare = !busy && (caption.trim().length > 0 || files.length > 0);
  const closeDialog = askClose ? (
    <div role="alertdialog" aria-label="Save this post as a draft?" className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-[#1B3A24] p-5 text-center shadow-2xl">
        <p className="text-base font-semibold text-white">Save this as a draft?</p>
        <p className="mt-1 text-sm text-white/70">Your photos and caption stay on this device so you can finish later.</p>
        <button type="button" onClick={() => void keepDraft()} className={`${ACCENT} mt-4 w-full rounded-full py-3 text-sm font-semibold`}>Save draft</button>
        <button type="button" onClick={() => void discardDraft()} className="mt-2 w-full rounded-full py-3 text-sm font-semibold text-red-300 hover:bg-white/5">Discard</button>
        <button type="button" onClick={() => setAskClose(false)} className="w-full rounded-full py-3 text-sm font-semibold text-white/80 hover:bg-white/5">Keep editing</button>
      </div>
    </div>
  ) : null;
  const shell = "fixed inset-0 z-[100] flex items-stretch justify-center bg-black sm:p-6";
  const panel = "relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#0F2A17] text-white sm:h-[min(92vh,860px)] sm:rounded-2xl";
  const header = (left: React.ReactNode, title: string, right?: React.ReactNode) => (
    <header className={`shrink-0 border-b border-white/10 px-3 pb-2 ${topPad}`}>
      <div className="flex min-h-14 items-center">
        <div className="flex w-16 justify-start">{left}</div>
        <h2 className="flex-1 text-center text-lg font-semibold text-white">{title}</h2>
        <div className="flex w-16 justify-end">{right}</div>
      </div>
    </header>
  );
  const sheetBox = "absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto rounded-t-2xl bg-[#1B3A24] p-4 shadow-2xl";

  // ------------------------------------------------------------ 1. gallery
  if (screen === "pick") {
    const shown = files[cur] ?? files[0];
    return (
      <div role="dialog" aria-modal="true" aria-label="New post" className={shell}>
        <div className={panel}>
          {closeDialog}
          {header(
            <button type="button" aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={requestClose}><X className="h-6 w-6" /></button>,
            "New post",
          )}
          <div className="flex-1 overflow-y-auto">
            {saved && files.length === 0 && (
              <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#F5B82E]/15 px-3 py-2.5">
                <p className="text-sm text-white/90">You have a saved draft{saved.caption ? `: ${saved.caption.slice(0, 40)}${saved.caption.length > 40 ? "…" : ""}` : ""}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => { void clearDraft(slug); setSaved(null); }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">Delete</button>
                  <button type="button" onClick={resumeDraft} className="rounded-full bg-[#F5B82E] px-3 py-1.5 text-xs font-bold text-[#14301A]">Continue</button>
                </div>
              </div>
            )}
            <div className="mx-auto flex h-[46vh] items-center justify-center bg-black">
              {shown ? (
                <div className="relative aspect-[4/5] h-full">
                  {isVideo
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    ? <video src={urls[0]} controls playsInline preload="metadata" className="h-full w-full object-contain" onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.05; }} onError={(e) => setVideoProblem(e.currentTarget.error?.code ?? 0)} onLoadedData={() => setVideoProblem(null)} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={urls[Math.min(cur, urls.length - 1)]} alt="" className="h-full w-full object-cover" />}
                                </div>
              ) : <div className="px-8 text-center"><p className="text-sm text-white/70">Choose photos or a video from your phone.</p><button type="button" onClick={() => void openGallery(true)} className={`${ACCENT} mt-4 rounded-full px-6 py-3.5 text-base font-semibold`}>Open my photos and videos</button></div>}
            </div>
            {videoProblem !== null && isVideo && (
              <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200">This phone&apos;s browser can&apos;t play a preview of this video (error {videoProblem}). It is probably a format Safari can&apos;t decode here. You can still continue: it is converted to a standard video when it uploads and will play normally in Browse.</p>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" className="flex min-h-11 items-center gap-1 text-lg font-bold" onClick={() => void openGallery(false)}>Photos and videos<ChevronRight className="h-5 w-5" aria-hidden /></button>
              <button type="button" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold" onClick={() => void openGallery(true)}><ImageIcon className="h-4 w-4" aria-hidden />Pick several</button>
            </div>
            <div className="grid grid-cols-4 gap-0.5 px-0.5 pb-6">
              <button type="button" aria-label="Take a photo or video" className="flex aspect-square items-center justify-center bg-white/10" onClick={() => camera.current?.click()}><Camera className="h-8 w-8" aria-hidden /></button>
              <button type="button" aria-label="Add from gallery" className="flex aspect-square items-center justify-center bg-white/5" onClick={() => void openGallery(true)}><Plus className="h-8 w-8" aria-hidden /></button>
              {files.map((f, i) => (
                <div key={`${i}-${f.name}`} className={`relative aspect-square overflow-hidden bg-white/10 ${cur === i ? "ring-2 ring-inset ring-[#F5B82E]" : ""}`}>
                  <button type="button" className="h-full w-full" aria-label={`Preview ${f.name}`} onClick={() => setCur(i)}>
                    {isVideo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? (thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null)
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={urls[i]} alt="" className="h-full w-full object-cover" />}
                  </button>
                  {isVideo && duration != null && <span className="absolute bottom-1 right-1.5 text-sm font-bold text-white drop-shadow">{fmt(duration)}</span>}
                  {!isVideo && files.length > 1 && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F5B82E] text-xs font-bold text-[#14301A]">{i + 1}</span>}
                  <button type="button" aria-label="Remove" className="absolute left-1 top-1 rounded-full bg-black/60 p-0.5" onClick={() => removeFile(i)}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            {error && <p role="alert" className="px-4 pb-4 text-sm text-red-400">{error}</p>}
          </div>
          <div className={`shrink-0 border-t border-white/10 px-4 pt-3 ${botPad}`}>
            <p className="mb-2 text-center text-xs text-white/60">Up to {BROWSE_MAX_IMAGES} photos, or one video{unlimited ? "" : ` up to ${BROWSE_VIDEO_MAX_SECONDS} seconds`}.</p>
            <button type="button" disabled={files.length === 0} onClick={() => setScreen("edit")} className={`${ACCENT} flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold disabled:opacity-40`}>Continue<ArrowRight className="h-5 w-5" aria-hidden /></button>
          </div>
          <input ref={galleryOne} type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => void addFiles(e.target.files)} />
          <input ref={galleryMany} type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => void addFiles(e.target.files)} />
          <input ref={camera} type="file" accept="image/*,video/*" capture="environment" className="sr-only" onChange={(e) => void addFiles(e.target.files)} />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ 2. edit
  if (screen === "edit") {
    return (
      <div role="dialog" aria-modal="true" aria-label="Edit" className={shell}>
        <div className={`${panel} bg-black`}>
          <div className={`flex shrink-0 items-center px-3 pb-2 ${topPad}`}>
            <button type="button" aria-label="Back" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15" onClick={() => { mainVideo.current?.pause(); setScreen("pick"); }}><X className="h-6 w-6" /></button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            <Stage items={items} setItems={setItems} sel={sel} setSel={setSel} interactive className="aspect-[4/5] h-full max-w-full rounded-2xl">
              <div className="h-full w-full">
                {isVideo
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  ? <video ref={mainVideo} src={urls[0]} className="h-full w-full object-contain" playsInline muted autoPlay preload="auto" onLoadedMetadata={(e) => { e.currentTarget.currentTime = trim.start + 0.05; }} onError={(e) => setVideoProblem(e.currentTarget.error?.code ?? 0)} onLoadedData={() => setVideoProblem(null)} onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={() => togglePlay()} />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={urls[cur]} alt="" className="h-full w-full object-cover" draggable={false} />}
              </div>
            </Stage>
          </div>
          {videoProblem !== null && isVideo && <p role="alert" className="mx-4 mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200">The preview can&apos;t play on this browser (error {videoProblem}). Trim and cover pick are unavailable, but you can still continue and post.</p>}
          {isVideo && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold">{playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5 fill-white" aria-hidden />}{playing ? "Pause" : "Play"}</button>
              {duration == null && !unlimited && <p className="max-w-[55%] text-xs text-white/70">We couldn&apos;t read this video&apos;s length, so only the first {BROWSE_VIDEO_MAX_SECONDS} seconds will be posted.</p>}
            </div>
          )}
          {sel != null && items[sel] && (
            <div className="flex justify-center gap-2 py-2">
              <button type="button" className="rounded-full bg-white/15 p-2.5" aria-label="Smaller" onClick={() => resize(-0.25)}><Minus className="h-4 w-4" /></button>
              <button type="button" className="rounded-full bg-white/15 p-2.5" aria-label="Larger" onClick={() => resize(0.25)}><Plus className="h-4 w-4" /></button>
              <button type="button" className="flex items-center gap-1 rounded-full bg-white/15 px-3 text-sm text-red-300" onClick={removeItem}><Trash2 className="h-4 w-4" />Remove</button>
            </div>
          )}
          {!isVideo && files.length > 1 && (
            <div className="flex justify-center gap-2 py-2">
              {urls.map((u, i) => (
                <button key={u} type="button" onClick={() => setCur(i)} aria-label={`Photo ${i + 1}${i === 0 ? ", cover" : ""}`} className={`relative h-14 w-11 overflow-hidden rounded-lg ${cur === i ? "ring-2 ring-white" : "opacity-60"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] font-semibold">Cover</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3 px-4 pb-2 pt-1">
            {([["text", "Text", Type], ["stickers", "Stickers", Smile]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => { setSheet(k); mainVideo.current?.pause(); }} className="flex w-20 flex-col items-center gap-1.5 text-xs">
                <span className="flex h-14 w-full items-center justify-center rounded-2xl bg-white/12"><Icon className="h-6 w-6" aria-hidden /></span>{label}
              </button>
            ))}
            <button type="button" onClick={openCover} className="flex w-20 flex-col items-center gap-1.5 text-xs">
              <span className="flex h-14 w-full items-center justify-center rounded-2xl bg-white/12"><ImageIcon className="h-6 w-6" aria-hidden /></span>Cover
            </button>
          </div>
          <div className={`flex shrink-0 items-center justify-between px-4 pt-2 ${botPad}`}>
            {isVideo && duration != null
              ? <button type="button" className={`${ghostBtn} flex items-center gap-2 bg-[#23262e] px-5 py-3`} onClick={() => { setSheet("trim"); mainVideo.current?.play().catch(() => {}); }}><Scissors className="h-4 w-4" aria-hidden />Trim video</button>
              : <span />}
            <button type="button" className={`${ACCENT} flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold`} onClick={() => { mainVideo.current?.pause(); setScreen("details"); }}>Continue<ArrowRight className="h-5 w-5" aria-hidden /></button>
          </div>

          {sheet === "trim" && isVideo && duration != null && (
            <div className={sheetBox} role="dialog" aria-label="Trim video">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Trim video</h3><button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#F5B82E]" onClick={() => setSheet(null)}>Done</button></div>
              <p className="mb-2 text-xs">Clip: <b>{fmt(trim.start)}</b> to <b>{fmt(trim.end)}</b> · {fmt(span)} long{!unlimited && ` (max ${BROWSE_VIDEO_MAX_SECONDS} seconds)`}</p>
              <label className="block text-xs">Start<input type="range" className="mt-1 w-full accent-[#F5B82E]" min={0} max={duration} step={0.1} value={trim.start} onChange={(e) => moveTrim("start", +e.target.value)} /></label>
              <label className="mt-2 block text-xs">End<input type="range" className="mt-1 w-full accent-[#F5B82E]" min={0} max={duration} step={0.1} value={trim.end} onChange={(e) => moveTrim("end", +e.target.value)} /></label>
              {!unlimited && duration > BROWSE_VIDEO_MAX_SECONDS && <p className="mt-2 text-xs text-white/60">This video is {fmt(duration)}. Pick the {BROWSE_VIDEO_MAX_SECONDS} seconds you want to keep.</p>}
            </div>
          )}
          {sheet === "stickers" && (
            <div className={sheetBox} role="dialog" aria-label="Stickers">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Stickers</h3><button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#F5B82E]" onClick={() => setSheet(null)}>Close</button></div>
              {!isVideo && cur !== 0 && <p className="mb-2 text-xs text-white/60">Stickers go on the cover photo. Select the first photo to place them.</p>}
              <div className="grid grid-cols-8 gap-1.5">
                {STICKER_CHOICES.map((e) => <button key={e} type="button" disabled={!isVideo && cur !== 0} onClick={() => addEmoji(e)} aria-label={`Add ${e}`} className="rounded-lg py-1.5 text-2xl hover:bg-white/10 disabled:opacity-40">{e}</button>)}
              </div>
            </div>
          )}
          {sheet === "text" && (
            <div className={sheetBox} role="dialog" aria-label="Add text">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Add text</h3><button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#F5B82E]" onClick={() => setSheet(null)}>Close</button></div>
              <input autoFocus className={`w-full rounded-xl bg-white/10 px-3 py-3 text-base outline-none ${field}`} maxLength={BROWSE_TEXT_MAX} placeholder="Type something…" value={textDraft} onChange={(e) => setTextDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addText(); }} />
              <button type="button" className={`${ACCENT} mt-3 w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50`} disabled={!textDraft.trim()} onClick={addText}>Add to picture</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ 4. cover
  if (screen === "cover") {
    return (
      <div role="dialog" aria-modal="true" aria-label="Choose cover" className={shell}>
        <div className={panel}>
          {closeDialog}
          {header(<span />, "Choose cover")}
          <div className="grid grid-cols-2 border-b border-white/10 text-center text-sm font-semibold">
            {(["cover", "grid"] as const).map((t) => <button key={t} type="button" onClick={() => setCoverTab(t)} className={`py-3 ${coverTab === t ? "border-b-2 border-white" : "text-white/50"}`}>{t === "cover" ? "Cover" : "Profile tile"}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto">
            <p className="px-6 py-4 text-center text-sm text-white/70">{coverTab === "cover" ? "Select a cover image from your video or camera roll and add text." : "This is how your post is cropped on your profile."}</p>
            {coverTab === "cover" ? (
              <div className="relative mx-auto w-[62%] max-w-xs">
                <Stage items={items} setItems={setItems} sel={sel} setSel={setSel} interactive className="aspect-[4/5] rounded-3xl">{coverMedia("contain")}</Stage>
                <button type="button" aria-label="Add text" onClick={() => setSheet("text")} className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55"><Type className="h-5 w-5" /></button>
                {sel != null && items[sel] && (
                  <div className="absolute right-3 top-3 flex gap-1.5">
                    <button type="button" className="rounded-full bg-black/60 p-2" aria-label="Smaller" onClick={() => resize(-0.25)}><Minus className="h-4 w-4" /></button>
                    <button type="button" className="rounded-full bg-black/60 p-2" aria-label="Larger" onClick={() => resize(0.25)}><Plus className="h-4 w-4" /></button>
                    <button type="button" className="rounded-full bg-black/60 p-2 text-red-300" aria-label="Remove" onClick={removeItem}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-auto w-[48%] max-w-[220px]"><Stage items={items} setItems={setItems} sel={null} setSel={() => {}} interactive={false} className="aspect-square rounded-lg">{coverMedia("cover")}</Stage></div>
            )}

            <div className="px-4 py-5">
              {isVideo && !customCover && (
                <>
                  <div className="flex h-16 overflow-hidden rounded-lg border border-white/15">
                    {(frames.length ? frames : Array.from({ length: 8 }, () => null)).map((f, i, arr) => {
                      const rel = (span * i) / Math.max(1, arr.length - 1);
                      const on = Math.abs(rel - coverRel) < span / (arr.length * 2);
                      return (
                        <button key={i} type="button" aria-label={`Frame ${i + 1}`} onClick={() => setCoverRel(Math.min(rel, Math.max(0, span - 0.1)))} className={`h-full min-w-0 flex-1 bg-white/10 ${on ? "outline outline-2 -outline-offset-2 outline-[#F5B82E]" : ""}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {f && <img src={f} alt="" className="h-full w-full object-cover" />}
                        </button>
                      );
                    })}
                  </div>
                  <input type="range" aria-label="Pick the cover frame" className="mt-3 w-full accent-[#F5B82E]" min={0} max={Math.max(0.1, span - 0.1)} step={0.1} value={coverRel} onChange={(e) => setCoverRel(+e.target.value)} />
                </>
              )}
              {!isVideo && files.length > 1 && (
                <div className="flex justify-center gap-2">
                  {urls.map((u, i) => (
                    <button key={u} type="button" onClick={() => makeCover(i)} aria-label={`Use photo ${i + 1} as cover`} className={`h-16 w-12 overflow-hidden rounded-lg ${i === 0 ? "ring-2 ring-[#F5B82E]" : "opacity-60"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {isVideo && (
                <>
                  <button type="button" className={`${ACCENT} mt-4 w-full rounded-full py-3.5 text-base font-semibold`} onClick={() => coverPicker.current?.click()}>Use my own image</button>
                  {customCover && <button type="button" className="mt-2 w-full py-2 text-sm text-white/70" onClick={() => setCustomCover(null)}>Use a frame from the video instead</button>}
                  <input ref={coverPicker} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCustomCover(f); e.target.value = ""; }} />
                </>
              )}
            </div>
          </div>
          <div className={`flex shrink-0 gap-3 border-t border-white/10 px-4 pt-3 ${botPad}`}>
            <button type="button" className={`${ghostBtn} flex-1 py-3.5`} onClick={cancelCover}>Cancel</button>
            <button type="button" className={`${ACCENT} flex-1 rounded-full py-3.5 text-base font-semibold`} onClick={() => setScreen("details")}>Use this cover</button>
          </div>
          {sheet === "text" && (
            <div className={sheetBox} role="dialog" aria-label="Add text">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Add text</h3><button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#F5B82E]" onClick={() => setSheet(null)}>Close</button></div>
              <input autoFocus className={`w-full rounded-xl bg-white/10 px-3 py-3 text-base outline-none ${field}`} maxLength={BROWSE_TEXT_MAX} placeholder="Type something…" value={textDraft} onChange={(e) => setTextDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addText(); }} />
              <button type="button" className={`${ACCENT} mt-3 w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50`} disabled={!textDraft.trim()} onClick={addText}>Add to cover</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ 3. details
  const row = "flex w-full items-center gap-3 border-b border-white/10 px-4 py-4 text-left text-base";
  return (
    <div role="dialog" aria-modal="true" aria-label="Post details" className={shell}>
      <div className={panel}>
          {closeDialog}
        {header(<button type="button" disabled={busy} aria-label="Back" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50" onClick={() => setScreen("edit")}><ArrowLeft className="h-6 w-6" /></button>, "Post details")}
        <div className="flex-1 overflow-y-auto">
          <div className="relative mx-auto my-5 w-40">
            <Stage items={items} setItems={setItems} sel={null} setSel={() => {}} interactive={false} className="aspect-[4/5] rounded-3xl border border-white/15">{coverMedia("contain")}</Stage>
            <button type="button" onClick={() => setPreview(true)} className="absolute left-2.5 top-2.5 rounded-xl bg-black/65 px-3 py-1.5 text-sm font-semibold">Play preview</button>
            <button type="button" onClick={openCover} className="absolute bottom-2.5 left-2.5 rounded-xl bg-black/65 px-3 py-1.5 text-sm font-semibold">Choose cover</button>
          </div>
          <div className="px-4">
            <textarea className={`h-28 w-full resize-none bg-transparent text-base outline-none ${field}`} maxLength={BROWSE_CAPTION_MAX} placeholder="Add a caption…" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" />
            <p className="text-right text-xs text-white/40">{caption.length}/{BROWSE_CAPTION_MAX}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-1">
            <button type="button" aria-pressed={showTags} onClick={() => setShowTags((v) => !v)} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold"><Hash className="h-5 w-5" aria-hidden />Hashtags</button>
            <button type="button" onClick={() => setTagOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold"><Tag className="h-5 w-5" aria-hidden />Product or service</button>
          </div>
          {showTags && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-4">
              {HASHTAG_SUGGESTIONS.map((t) => <button key={t} type="button" onClick={() => setCaption((c) => (c.includes(`#${t}`) || c.length + t.length + 2 > BROWSE_CAPTION_MAX ? c : `${c}${c && !/\s$/.test(c) ? " " : ""}#${t} `))} className="rounded-full border border-white/20 px-3 py-1 text-sm">#{t}</button>)}
            </div>
          )}
          <div className="border-t border-white/10">
            <button type="button" className={row} onClick={() => setPeopleOpen(true)}><UserRound className="h-6 w-6" aria-hidden /><span className="flex-1">Tag businesses and customers</span><span className="text-sm text-white/55">{people.length ? `${people.length} tagged` : ""}</span><ChevronRight className="h-5 w-5 text-white/60" aria-hidden /></button>
            <button type="button" className={row} onClick={() => setTagOpen(true)}><Tag className="h-6 w-6" aria-hidden /><span className="flex-1">Tag a product or service</span><span className="max-w-[40%] truncate text-sm text-white/55">{taggedLabel ?? ""}</span><ChevronRight className="h-5 w-5 text-white/60" aria-hidden /></button>
            <button type="button" className={row} onClick={() => setLocationOpen((v) => !v)}><MapPin className="h-6 w-6" aria-hidden /><span className="flex-1">Add location</span><span className="max-w-[40%] truncate text-sm text-white/55">{location}</span><ChevronRight className="h-5 w-5 text-white/60" aria-hidden /></button>
            {locationOpen && <div className="border-b border-white/10 px-4 py-3"><input className={`w-full rounded-xl bg-white/10 px-3 py-3 text-base outline-none ${field}`} maxLength={BROWSE_LOCATION_MAX} placeholder="e.g. Lekki Phase 1, Lagos" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location" /></div>}
            <div className={row}>
              <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
              <div className="flex-1"><p>Made with AI</p><p className="mt-1 text-sm text-white/55">Turn this on for realistic photos or videos created with AI. It shows on your post.</p></div>
              <button type="button" role="switch" aria-checked={ai} aria-label="AI label" onClick={() => setAi((v) => !v)} className={`relative h-8 w-14 shrink-0 rounded-full transition ${ai ? "bg-[#F5B82E]" : "bg-white/25"}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${ai ? "left-7" : "left-1"}`} /></button>
            </div>
          </div>
          {progress !== null && (
            <div role="status" aria-live="polite" className="px-4 pt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-[#F5B82E] transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs text-white/60">Uploading… {progress}%</p>
            </div>
          )}
          {error && <p role="alert" className="px-4 pt-4 text-sm text-red-400">{error}</p>}
          <div className="h-6" />
        </div>
        <div className={`shrink-0 border-t border-white/10 px-4 pt-3 ${botPad}`}>
          <button type="button" disabled={!canShare} onClick={share} className={`${ACCENT} w-full rounded-full py-3.5 text-base font-semibold disabled:opacity-50`}>{busy ? "Posting…" : "Post now"}</button>
        </div>

        {peopleOpen && <PeopleSheet slug={slug} unlimited={unlimited} selected={people} onChange={setPeople} onClose={() => setPeopleOpen(false)} />}
        {tagOpen && (
          <div className={sheetBox} role="dialog" aria-label="Tag a product or service">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Tag a product or service</h3><button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#F5B82E]" onClick={() => setTagOpen(false)}>Done</button></div>
            <p className="mb-3 text-xs text-white/55">Tagged items show a buy or book button on your post.</p>
            <ul className="space-y-1">
              <li><button type="button" onClick={() => { setTag(""); setTagOpen(false); }} className={`w-full rounded-lg px-3 py-3 text-left text-sm ${tag === "" ? "bg-white/15" : "hover:bg-white/10"}`}>None</button></li>
              {products.length > 0 && <li className="px-3 pt-2 text-xs font-semibold text-white/50">Products</li>}
              {products.map((p) => <li key={p.id}><button type="button" onClick={() => { setTag(`product:${p.id}`); setTagOpen(false); }} className={`w-full rounded-lg px-3 py-3 text-left text-sm ${tag === `product:${p.id}` ? "bg-white/15" : "hover:bg-white/10"}`}>{p.name}</button></li>)}
              {services.length > 0 && <li className="px-3 pt-2 text-xs font-semibold text-white/50">Services</li>}
              {services.map((p) => <li key={p.id}><button type="button" onClick={() => { setTag(`service:${p.id}`); setTagOpen(false); }} className={`w-full rounded-lg px-3 py-3 text-left text-sm ${tag === `service:${p.id}` ? "bg-white/15" : "hover:bg-white/10"}`}>{p.name}</button></li>)}
              {products.length + services.length === 0 && <li className="px-3 py-3 text-sm text-white/55">You have no published products or services to tag yet.</li>}
            </ul>
          </div>
        )}
        {preview && (
          <div role="dialog" aria-modal="true" aria-label="Preview" className="absolute inset-0 z-20 flex flex-col bg-black">
            <div className={`flex items-center px-3 pb-2 ${topPad}`}><button type="button" aria-label="Close preview" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15" onClick={() => setPreview(false)}><X className="h-5 w-5" /></button></div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
              <Stage items={items} setItems={setItems} sel={null} setSel={() => {}} interactive={false} className="aspect-[4/5] h-full max-w-full rounded-2xl">
                <div className="h-full w-full">
                  {isVideo
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    ? <video ref={previewVideo} src={urls[0]} className="h-full w-full object-contain" playsInline autoPlay controls muted onLoadedMetadata={() => { if (previewVideo.current) previewVideo.current.currentTime = trim.start; }} onTimeUpdate={() => { const v = previewVideo.current; if (v && (v.currentTime >= trim.end - 0.05)) v.currentTime = trim.start; }} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={urls[0]} alt="" className="h-full w-full object-cover" />}
                </div>
              </Stage>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Search other businesses, plus (not for the official account) the store's own customers. */
function PeopleSheet({ slug, unlimited, selected, onChange, onClose }: { slug: string; unlimited: boolean; selected: Person[]; onChange: (p: Person[]) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setMsg(""); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/browse/tag-search?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const body = await r.json().catch(() => null);
        if (!r.ok) { setMsg(body?.error ?? "Search failed."); setResults([]); return; }
        setResults(body.results ?? []); setMsg((body.results ?? []).length === 0 ? "No one found." : "");
      } catch { /* cancelled */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, slug]);
  const has = (p: Person) => selected.some((s) => s.kind === p.kind && s.id === p.id);
  const toggle = (p: Person) => onChange(has(p) ? selected.filter((s) => !(s.kind === p.kind && s.id === p.id)) : selected.length >= BROWSE_MAX_TAGS ? selected : [...selected, p]);
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0F2A17]" role="dialog" aria-label="Tag businesses and customers">
      <header className={`flex shrink-0 items-center border-b border-white/10 px-3 pb-2 ${topPad}`}>
        <button type="button" aria-label="Back" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" onClick={onClose}><ArrowLeft className="h-6 w-6" /></button>
        <h2 className="flex-1 text-center text-base font-semibold text-white">Tag businesses and customers</h2>
        <button type="button" className="min-h-12 w-16 pr-2 text-right text-base font-semibold text-[#F5B82E]" onClick={onClose}>Done</button>
      </header>
      <div className="p-4">
        <input autoFocus className={`w-full rounded-xl bg-white/10 px-3 py-3 text-base outline-none ${field}`} placeholder={unlimited ? "Search businesses" : "Search businesses and your customers"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.map((p) => <button key={`${p.kind}:${p.id}`} type="button" onClick={() => toggle(p)} className="flex items-center gap-1 rounded-full bg-[#F5B82E]/30 py-1 pl-3 pr-2 text-sm">{p.name}<X className="h-3.5 w-3.5" aria-label={`Remove ${p.name}`} /></button>)}
          </div>
        )}
        <p className="mt-2 text-xs text-white/50">Up to {BROWSE_MAX_TAGS}. Tagged people are notified. Customers appear as first name and initial.</p>
      </div>
      <ul className="flex-1 overflow-y-auto px-2">
        {results.map((p) => (
          <li key={`${p.kind}:${p.id}`}>
            <button type="button" onClick={() => toggle(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-bold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-full w-full object-cover" /> : p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1"><span className="block truncate text-base">{p.name}</span><span className="text-xs text-white/55">{p.sub}</span></span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${has(p) ? "border-[#F5B82E] bg-[#F5B82E]" : "border-white/30"}`}>{has(p) && <span className="text-xs">✓</span>}</span>
            </button>
          </li>
        ))}
        {msg && <li className="px-3 py-4 text-sm text-white/55">{msg}</li>}
      </ul>
    </div>
  );
}
