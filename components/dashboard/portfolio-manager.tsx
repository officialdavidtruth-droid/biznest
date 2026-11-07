"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addPortfolioImages, createPortfolioAlbum, deletePortfolioAlbum, movePortfolioAlbum, removePortfolioImage,
  setPortfolioCaption, setPortfolioCover, updatePortfolioAlbum, listPortfolioAlbums,
  type PortfolioAlbumDTO,
} from "@/lib/actions/portfolio";
import { MAX_PORTFOLIO_IMAGES, PORTFOLIO_CATEGORY_SUGGESTIONS, displayImageUrl } from "@/lib/portfolio";

export function PortfolioManager({ slug, initial, portfolioUrl }: { slug: string; initial: PortfolioAlbumDTO[]; portfolioUrl: string }) {
  const [albums, setAlbums] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const replace = (a: PortfolioAlbumDTO) => setAlbums((list) => list.map((x) => (x.id === a.id ? a : x)));
  const reload = async () => { const r = await listPortfolioAlbums(slug); if ("albums" in r) setAlbums(r.albums); };

  const create = () => start(async () => {
    const r = await createPortfolioAlbum(slug, { title, category });
    if (!r.success) { toast.error(r.error); return; }
    setAlbums((l) => [...l, r.data]); setOpen(r.data.id); setTitle(""); setCategory("");
    toast.success("Album created. Add your photos next.");
  });

  const save = (a: PortfolioAlbumDTO, patch: Parameters<typeof updatePortfolioAlbum>[2], message?: string) => start(async () => {
    const r = await updatePortfolioAlbum(slug, a.id, patch);
    if (!r.success) { toast.error(r.error); return; }
    replace({ ...a, ...patch } as PortfolioAlbumDTO);
    if (message) toast.success(message);
  });

  const remove = (a: PortfolioAlbumDTO) => {
    if (!window.confirm(`Delete "${a.title}" and its ${a.images.length} photos from your portfolio?`)) return;
    start(async () => {
      const r = await deletePortfolioAlbum(slug, a.id);
      if (!r.success) { toast.error(r.error); return; }
      setAlbums((l) => l.filter((x) => x.id !== a.id));
    });
  };

  const move = (a: PortfolioAlbumDTO, d: "up" | "down") => start(async () => {
    const r = await movePortfolioAlbum(slug, a.id, d);
    if (!r.success) { toast.error(r.error); return; }
    await reload();
  });

  async function upload(a: PortfolioAlbumDTO, files: FileList | null) {
    if (!files?.length) return;
    setUploading(a.id);
    const urls: string[] = [];
    try {
      // One at a time: the upload route is rate limited, and a failed photo shouldn't lose the ones before it.
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) { toast.error(`${file.name}: ${data.error || "Upload failed"}`); break; }
        urls.push(data.url);
      }
      if (urls.length) {
        const r = await addPortfolioImages(slug, a.id, urls);
        if (!r.success) toast.error(r.error); else { replace(r.data.album); toast.success(`${urls.length} photo${urls.length === 1 ? "" : "s"} added`); }
      }
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const dropImage = (id: string) => start(async () => {
    const r = await removePortfolioImage(slug, id);
    if (!r.success) { toast.error(r.error); return; }
    replace(r.data.album);
  });
  const makeCover = (a: PortfolioAlbumDTO, imageId: string, url: string) => start(async () => {
    const r = await setPortfolioCover(slug, imageId);
    if (!r.success) { toast.error(r.error); return; }
    replace({ ...a, coverUrl: url }); toast.success("Cover updated");
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Group your best work into albums, like Weddings or Portraits. Visitors see them on your Portfolio page. For final client deliveries, paste a Google Drive link on the job card instead, so quality is never reduced.</p>
        </div>
        <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">View portfolio page <ExternalLink className="h-4 w-4" /></a>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">New album</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Album name, e.g. Lagos weddings" maxLength={80} aria-label="Album name" className="rounded-lg border bg-background px-3 py-2 text-sm" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="portfolio-categories" placeholder="Category (optional)" maxLength={40} aria-label="Category" className="rounded-lg border bg-background px-3 py-2 text-sm" />
          <datalist id="portfolio-categories">{PORTFOLIO_CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          <button onClick={create} disabled={pending || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Plus className="h-4 w-4" /> Create album</button>
        </div>
      </div>

      {albums.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No albums yet. Create your first album above, then add photos to it.</div>}

      <div className="space-y-3">
        {albums.map((a, idx) => {
          const isOpen = open === a.id;
          return (
            <section key={a.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button onClick={() => setOpen(isOpen ? null : a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                  {a.coverUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={displayImageUrl(a.coverUrl, 200)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ImagePlus className="h-5 w-5" /></span>}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.category ? `${a.category} · ` : ""}{a.images.length} photo{a.images.length === 1 ? "" : "s"} · {a.isPublished ? "Visible on your site" : "Hidden"}</span>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(a, "up")} disabled={pending || idx === 0} aria-label={`Move ${a.title} up`} className="rounded-lg border p-2 disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(a, "down")} disabled={pending || idx === albums.length - 1} aria-label={`Move ${a.title} down`} className="rounded-lg border p-2 disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => save(a, { isPublished: !a.isPublished }, a.isPublished ? "Album hidden" : "Album published")} disabled={pending} className="rounded-lg border px-3 py-2 text-xs font-semibold">{a.isPublished ? "Hide" : "Publish"}</button>
                  <button onClick={() => remove(a)} disabled={pending} aria-label={`Delete ${a.title}`} className="rounded-lg border p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="space-y-4 border-t p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold">Name
                      <input defaultValue={a.title} maxLength={80} onBlur={(e) => e.target.value.trim() !== a.title && save(a, { title: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">Category
                      <input defaultValue={a.category ?? ""} list="portfolio-categories" maxLength={40} onBlur={(e) => e.target.value.trim() !== (a.category ?? "") && save(a, { category: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Short description (optional)
                      <textarea defaultValue={a.description ?? ""} maxLength={500} rows={2} onBlur={(e) => e.target.value.trim() !== (a.description ?? "") && save(a, { description: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                    </label>
                  </div>

                  <div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(a, e.target.files)} />
                    <button onClick={() => fileRef.current?.click()} disabled={!!uploading || a.images.length >= MAX_PORTFOLIO_IMAGES} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                      <ImagePlus className="h-4 w-4" /> {uploading === a.id ? "Uploading…" : "Add photos"}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or WebP, up to 10 MB each. About 20 uploads every 10 minutes, so add big albums in batches. Photos are shown at web size; your originals stay with you.</p>
                  </div>

                  {a.images.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {a.images.map((img) => (
                        <li key={img.id} className="overflow-hidden rounded-xl border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={displayImageUrl(img.url, 400)} alt={img.caption || ""} loading="lazy" className="aspect-square w-full object-cover" />
                          <div className="space-y-2 p-2">
                            <input defaultValue={img.caption ?? ""} maxLength={140} placeholder="Caption (optional)" aria-label="Caption" onBlur={(e) => e.target.value.trim() !== (img.caption ?? "") && setPortfolioCaption(slug, img.id, e.target.value).then((r) => !r.success && toast.error(r.error))} className="w-full rounded-md border bg-background px-2 py-1 text-xs" />
                            <div className="flex items-center justify-between">
                              <button onClick={() => makeCover(a, img.id, img.url)} disabled={pending || a.coverUrl === img.url} className="inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-60"><Star className="h-3.5 w-3.5" /> {a.coverUrl === img.url ? "Cover" : "Make cover"}</button>
                              <button onClick={() => dropImage(img.id)} disabled={pending} aria-label="Remove photo" className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This album is empty. Add photos to show it on your site.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
