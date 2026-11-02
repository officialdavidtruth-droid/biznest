"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bold, Eye, ExternalLink, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Pencil, Quote, Heading2, Heading3, X } from "lucide-react";
import { SingleImageUpload } from "@/components/forms/single-image-upload";
import { MarkdownView } from "@/components/blog/markdown-view";
import { createBlogCategory, saveBlogPost } from "@/lib/actions/blog";
import { BLOG_MAX_TAGS, blogSlug, excerptFor, readingMinutes, wordCount, type BlogStatus } from "@/lib/blog";

type Post = { id: string; title: string; slug: string; excerpt: string; body: string; tags: string[]; categoryId: string; featuredImage: string; featuredImageAlt: string; isFeatured: boolean; status: BlogStatus; publishedAt: string | null; seoTitle: string; seoDescription: string };
type Props = { slug: string; storeName: string; categories: { id: string; name: string }[]; post: Post | null };

const field = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
const label = "mb-1 block text-xs font-semibold text-muted-foreground";
const box = "rounded-2xl border bg-background p-4";

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function BlogEditor({ slug, storeName, categories: initialCategories, post }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [id, setId] = useState(post?.id ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [postSlug, setPostSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [body, setBody] = useState(post?.body ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [image, setImage] = useState(post?.featuredImage ?? "");
  const [imageAlt, setImageAlt] = useState(post?.featuredImageAlt ?? "");
  const [featured, setFeatured] = useState(post?.isFeatured ?? false);
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? "DRAFT");
  const [publishedAt, setPublishedAt] = useState<string | null>(post?.publishedAt ?? null);
  const [schedule, setSchedule] = useState(post?.status === "SCHEDULED" ? toLocalInput(post.publishedAt) : "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const words = useMemo(() => wordCount(body), [body]);
  const minutes = useMemo(() => readingMinutes(body), [body]);
  const autoExcerpt = useMemo(() => excerptFor({ excerpt: "", body }), [body]);
  const finalSlug = postSlug || blogSlug(title) || "post";

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function wrap(before: string, after = before, placeholder = "text") {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const chosen = value.slice(s, e) || placeholder;
    const next = `${value.slice(0, s)}${before}${chosen}${after}${value.slice(e)}`;
    touch(setBody)(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + chosen.length); });
  }
  function linePrefix(prefix: string) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const end = e + (value.slice(e).indexOf("\n") === -1 ? value.length - e : value.slice(e).indexOf("\n"));
    const block = value.slice(start, end).split("\n").map((l, i) => (prefix === "1. " ? `${i + 1}. ${l}` : `${prefix}${l}`)).join("\n");
    touch(setBody)(`${value.slice(0, start)}${block}${value.slice(end)}`);
    requestAnimationFrame(() => el.focus());
  }
  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    touch(setBody)(`${body.slice(0, at)}${text}${body.slice(at)}`);
  }
  function addLink() {
    const url = window.prompt("Link address (https://…)");
    if (!url) return;
    wrap("[", `](${url.trim()})`, "link text");
  }
  async function uploadInline(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error ?? "Upload failed");
      insertAtCursor(`\n\n![${file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")}](${out.url})\n\n`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function addTag(raw: string) {
    const next = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!next.length) return;
    const merged = [...tags];
    for (const t of next) if (merged.length < BLOG_MAX_TAGS && !merged.some((x) => x.toLowerCase() === t.toLowerCase())) merged.push(t.slice(0, 32));
    touch(setTags)(merged);
    setTagInput("");
  }
  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    start(async () => {
      const r = await createBlogCategory(slug, name);
      if (!r.success) return void toast.error(r.error);
      setCategories((c) => (c.some((x) => x.id === r.data.id) ? c : [...c, r.data].sort((a, b) => a.name.localeCompare(b.name))));
      touch(setCategoryId)(r.data.id);
      setNewCategory("");
    });
  }

  function save(intent: BlogStatus) {
    start(async () => {
      const r = await saveBlogPost(slug, {
        id: id || undefined, title, slug: slugTouched ? postSlug : undefined, excerpt, body, tags, categoryId, featuredImage: image, featuredImageAlt: imageAlt,
        isFeatured: featured, seoTitle, seoDescription, intent, scheduledFor: intent === "SCHEDULED" && schedule ? new Date(schedule).toISOString() : null,
      });
      if (!r.success) return void toast.error(r.error);
      setDirty(false);
      setStatus(r.data.status);
      setPostSlug(r.data.slug);
      if (r.data.status === "PUBLISHED" && !publishedAt) setPublishedAt(new Date().toISOString());
      toast.success(r.data.status === "PUBLISHED" ? "Post published" : r.data.status === "SCHEDULED" ? "Post scheduled" : "Draft saved");
      if (!id) { setId(r.data.id); router.replace(`/store/${slug}/admin/blog/${r.data.id}`); }
      router.refresh();
    });
  }

  const live = status === "PUBLISHED";
  const viewHref = `/store/${slug}/blog/${finalSlug}`;
  const seoShownTitle = (seoTitle || title || "Post title").slice(0, 60);
  const seoShownDesc = (seoDescription || excerpt || autoExcerpt || "Your post summary appears here.").slice(0, 160);

  const tool = (icon: React.ReactNode, title: string, run: () => void) => (
    <button type="button" title={title} aria-label={title} onClick={run} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{icon}</button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/store/${slug}/admin/blog`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All posts</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : id ? "All changes saved" : "New post"} · {words} words · {minutes} min read</span>
          {live && <Link href={viewHref} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"><ExternalLink className="h-3.5 w-3.5" />View</Link>}
          <button type="button" disabled={pending} onClick={() => save("DRAFT")} className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-50">{live ? "Unpublish & save draft" : "Save draft"}</button>
          {schedule && !live && <button type="button" disabled={pending} onClick={() => save("SCHEDULED")} className="rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">Schedule</button>}
          <button type="button" disabled={pending} onClick={() => save("PUBLISHED")} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{live ? "Update" : "Publish now"}</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <input value={title} onChange={(e) => { touch(setTitle)(e.target.value); if (!slugTouched) setPostSlug(blogSlug(e.target.value)); }} placeholder="Post title" maxLength={150} className="w-full rounded-2xl border bg-background px-4 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">/blog/</span>
            <input value={postSlug} onChange={(e) => { setSlugTouched(true); touch(setPostSlug)(blogSlug(e.target.value)); }} placeholder="post-address" className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 text-xs outline-none" />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-background">
            <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
              <div className="mr-2 flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
                <button type="button" onClick={() => setTab("write")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1 ${tab === "write" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Pencil className="h-3 w-3" />Write</button>
                <button type="button" onClick={() => setTab("preview")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1 ${tab === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Eye className="h-3 w-3" />Preview</button>
              </div>
              {tab === "write" && <>
                {tool(<Heading2 className="h-4 w-4" />, "Heading", () => linePrefix("# "))}
                {tool(<Heading3 className="h-4 w-4" />, "Subheading", () => linePrefix("## "))}
                {tool(<Bold className="h-4 w-4" />, "Bold", () => wrap("**"))}
                {tool(<Italic className="h-4 w-4" />, "Italic", () => wrap("*"))}
                {tool(<Link2 className="h-4 w-4" />, "Link", addLink)}
                {tool(<Quote className="h-4 w-4" />, "Quote", () => linePrefix("> "))}
                {tool(<List className="h-4 w-4" />, "Bulleted list", () => linePrefix("- "))}
                {tool(<ListOrdered className="h-4 w-4" />, "Numbered list", () => linePrefix("1. "))}
                {tool(<Minus className="h-4 w-4" />, "Divider", () => insertAtCursor("\n\n---\n\n"))}
                {tool(<ImagePlus className="h-4 w-4" />, uploading ? "Uploading…" : "Insert image", () => fileRef.current?.click())}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadInline(e.target.files[0])} />
              </>}
            </div>
            {tab === "write" ? (
              <textarea ref={bodyRef} value={body} onChange={(e) => touch(setBody)(e.target.value)} placeholder={"Start writing…\n\n# Use # for headings, **bold**, *italic*, [links](https://…), and - for lists."} className="min-h-[460px] w-full resize-y bg-background p-4 font-mono text-sm leading-relaxed outline-none" />
            ) : (
              <div className="min-h-[460px] p-6">
                <h1 className="mb-4 text-3xl font-bold">{title || "Untitled post"}</h1>
                {body.trim() ? <MarkdownView markdown={body} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className={box}>
            <h3 className="mb-3 text-sm font-bold">Publish</h3>
            <p className="mb-3 text-xs text-muted-foreground">Status: <strong className="text-foreground">{status === "PUBLISHED" ? "Published" : status === "SCHEDULED" ? "Scheduled" : "Draft"}</strong>{publishedAt && status !== "DRAFT" ? ` · ${new Date(publishedAt).toLocaleString()}` : ""}</p>
            {!live && <>
              <label className={label}>Schedule for later (optional)</label>
              <input type="datetime-local" value={schedule} onChange={(e) => touch(setSchedule)(e.target.value)} className={field} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Set a time, then press Schedule. The post goes live on its own at that time.</p>
            </>}
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={featured} onChange={(e) => touch(setFeatured)(e.target.checked)} />Pin as the featured post</label>
          </div>

          <div className={box}>
            <label className={label}>Category</label>
            <select value={categoryId} onChange={(e) => touch(setCategoryId)(e.target.value)} className={field}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} placeholder="New category" maxLength={60} className={field} />
              <button type="button" onClick={addCategory} disabled={pending || !newCategory.trim()} className="rounded-xl border px-3 text-xs font-semibold disabled:opacity-50">Add</button>
            </div>
            <label className={`${label} mt-4`}>Tags</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => touch(setTags)(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button></span>)}
            </div>
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)} placeholder={tags.length >= BLOG_MAX_TAGS ? "Tag limit reached" : "Type a tag, press Enter"} disabled={tags.length >= BLOG_MAX_TAGS} className={field} />
          </div>

          <div className={box}>
            <label className={label}>Featured image</label>
            <SingleImageUpload value={image} onChange={touch(setImage)} label="Upload featured image" />
            {image && <input value={imageAlt} onChange={(e) => touch(setImageAlt)(e.target.value)} placeholder="Describe the image (for accessibility)" maxLength={160} className={`${field} mt-2`} />}
            <label className={`${label} mt-4`}>Excerpt</label>
            <textarea value={excerpt} onChange={(e) => touch(setExcerpt)(e.target.value)} rows={3} maxLength={300} placeholder={autoExcerpt || "A short summary shown on the blog page."} className={field} />
            <p className="mt-1 text-[11px] text-muted-foreground">{excerpt ? `${excerpt.length}/300` : "Left blank, the start of your post is used."}</p>
          </div>

          <div className={box}>
            <h3 className="mb-3 text-sm font-bold">Search appearance</h3>
            <div className="mb-3 rounded-xl border bg-muted/40 p-3">
              <div className="truncate text-[11px] text-muted-foreground">{storeName} › blog › {finalSlug}</div>
              <div className="truncate text-sm font-semibold text-blue-700 dark:text-blue-400">{seoShownTitle}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{seoShownDesc}</div>
            </div>
            <label className={label}>Search title</label>
            <input value={seoTitle} onChange={(e) => touch(setSeoTitle)(e.target.value)} maxLength={70} placeholder={title || "Defaults to the post title"} className={field} />
            <p className={`mt-1 text-[11px] ${seoTitle.length > 60 ? "text-amber-600" : "text-muted-foreground"}`}>{seoTitle.length}/60 recommended</p>
            <label className={`${label} mt-3`}>Search description</label>
            <textarea value={seoDescription} onChange={(e) => touch(setSeoDescription)(e.target.value)} rows={3} maxLength={170} placeholder="Defaults to the excerpt" className={field} />
            <p className={`mt-1 text-[11px] ${seoDescription.length > 160 ? "text-amber-600" : "text-muted-foreground"}`}>{seoDescription.length}/160 recommended</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
