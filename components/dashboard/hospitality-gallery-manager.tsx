"use client";

import { useState } from "react";
import { ImagePlus, Plus, Save, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { saveHospitalityGallery, type HospitalityGalleryContent, type GalleryAlbum, type GalleryImage } from "@/lib/actions/hospitality-content";

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function HospitalityGalleryManager({ slug, initial }: { slug: string; initial: HospitalityGalleryContent }) {
  const [content, setContent] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial.albums[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const patch = (p: Partial<HospitalityGalleryContent>) => setContent((v) => ({ ...v, ...p }));

  function addAlbum() {
    const album: GalleryAlbum = { id: uid(), title: "New collection", description: "", coverImage: "", images: [] };
    setContent((v) => ({ ...v, albums: [...v.albums, album] }));
    setOpen(album.id);
  }

  function updateAlbum(id: string, patchAlbum: Partial<GalleryAlbum>) {
    setContent((v) => ({ ...v, albums: v.albums.map((a) => a.id === id ? { ...a, ...patchAlbum } : a) }));
  }

  function removeAlbum(id: string) {
    setContent((v) => ({ ...v, albums: v.albums.filter((a) => a.id !== id) }));
  }

  async function upload(file: File, albumId: string, imageId?: string) {
    setUploading(imageId || albumId);
    try {
      const fd = new FormData(); fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      const album = content.albums.find((a) => a.id === albumId);
      if (!album) return;
      if (imageId) {
        updateAlbum(albumId, { images: album.images.map((i) => i.id === imageId ? { ...i, image: data.url } : i) });
      } else {
        updateAlbum(albumId, { coverImage: data.url });
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(null); }
  }

  function addImage(albumId: string) {
    const album = content.albums.find((a) => a.id === albumId);
    if (!album) return;
    const image: GalleryImage = { id: uid(), image: "", title: "New gallery image", caption: "", description: "", featured: false };
    updateAlbum(albumId, { images: [...album.images, image] });
  }

  async function save() {
    setSaving(true);
    const result = await saveHospitalityGallery(slug, content);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Gallery published");
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Hospitality content</p><h1 className="mt-2 text-2xl font-semibold">Gallery & visual stories</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create collections such as Exterior, Lobby, Rooms, Dining, Wellness and Events. Every image can carry its own title and story.</p></div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Publishing…" : "Publish gallery"}</button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="Eyebrow" value={content.eyebrow} onChange={(v) => patch({ eyebrow: v })} />
        <Field label="Page title" value={content.title} onChange={(v) => patch({ title: v })} />
        <Field label="Introduction" value={content.intro} onChange={(v) => patch({ intro: v })} textarea />
      </div>
    </div>

    <div className="space-y-3">
      {content.albums.map((album, index) => {
        const isOpen = open === album.id;
        return <div key={album.id} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            <button onClick={() => setOpen(isOpen ? null : album.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span className="truncate font-semibold">{album.title || "Untitled collection"}</span>{isOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}</button>
            <button onClick={() => removeAlbum(album.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete collection"><Trash2 className="h-4 w-4" /></button>
          </div>
          {isOpen && <div className="space-y-5 border-t border-border p-5">
            <div className="grid gap-4 md:grid-cols-2"><Field label="Collection title" value={album.title} onChange={(v) => updateAlbum(album.id, { title: v })} /><Field label="Description" value={album.description || ""} onChange={(v) => updateAlbum(album.id, { description: v })} textarea /></div>
            <div><label className="mb-2 block text-xs font-medium">Collection cover</label><div className="flex gap-3"><input value={album.coverImage || ""} onChange={(e) => updateAlbum(album.id, { coverImage: e.target.value })} placeholder="Image URL" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" /><label className="cursor-pointer rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted">{uploading === album.id ? "Uploading…" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={Boolean(uploading)} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, album.id); e.currentTarget.value = ""; }} /></label></div>{album.coverImage && <img src={album.coverImage} alt="" className="mt-3 h-36 w-full rounded-xl object-cover" />}</div>
            <div className="flex items-center justify-between"><div><h3 className="font-semibold">Images in this story</h3><p className="text-xs text-muted-foreground">Add a title and caption so the gallery feels editorial.</p></div><button onClick={() => addImage(album.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:bg-muted"><Plus className="h-3.5 w-3.5" /> Add image</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              {album.images.map((image) => <div key={image.id} className="rounded-xl border border-border p-3">
                <div className="flex gap-3"><div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">{image.image && <img src={image.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="flex gap-2"><input value={image.image} onChange={(e) => updateAlbum(album.id, { images: album.images.map((i) => i.id === image.id ? { ...i, image: e.target.value } : i) })} placeholder="Image URL" className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-xs" /><label className="cursor-pointer rounded border border-input px-2 py-1.5 text-xs">{uploading === image.id ? "…" : <ImagePlus className="h-3.5 w-3.5" />}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={Boolean(uploading)} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, album.id, image.id); e.currentTarget.value = ""; }} /></label></div><input value={image.title} onChange={(e) => updateAlbum(album.id, { images: album.images.map((i) => i.id === image.id ? { ...i, title: e.target.value } : i) })} placeholder="Image title" className="mt-2 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" /><input value={image.caption || ""} onChange={(e) => updateAlbum(album.id, { images: album.images.map((i) => i.id === image.id ? { ...i, caption: e.target.value } : i) })} placeholder="Caption" className="mt-2 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" /></div></div>
                <textarea value={image.description || ""} onChange={(e) => updateAlbum(album.id, { images: album.images.map((i) => i.id === image.id ? { ...i, description: e.target.value } : i) })} placeholder="Tell the story behind this image…" className="mt-3 min-h-20 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
                <div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(image.featured)} onChange={(e) => updateAlbum(album.id, { images: album.images.map((i) => i.id === image.id ? { ...i, featured: e.target.checked } : i) })} /> Feature this image</label><button onClick={() => updateAlbum(album.id, { images: album.images.filter((i) => i.id !== image.id) })} className="text-xs text-destructive">Remove</button></div>
              </div>)}
            </div>
            {!album.images.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This collection has no images yet.</div>}
          </div>}
        </div>;
      })}
    </div>
    <button onClick={addAlbum} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-4 w-4" /> Add gallery collection</button>
  </div>;
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return <label className="block text-xs"><span className="mb-1.5 block font-medium text-muted-foreground">{label}</span>{textarea ? <textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /> : <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />}</label>;
}
