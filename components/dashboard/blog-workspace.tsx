"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Newspaper, Pencil, Plus, Rss, Star, Trash2 } from "lucide-react";
import { createBlogCategory, deleteBlogCategory, deleteBlogPost, duplicateBlogPost, renameBlogCategory, setBlogPostStatus } from "@/lib/actions/blog";
import type { getBlogWorkspace } from "@/lib/actions/blog";
import type { BlogStatus } from "@/lib/blog";

type Data = NonNullable<Awaited<ReturnType<typeof getBlogWorkspace>>>;
const TABS: { id: "ALL" | BlogStatus; label: string }[] = [{ id: "ALL", label: "All" }, { id: "PUBLISHED", label: "Published" }, { id: "SCHEDULED", label: "Scheduled" }, { id: "DRAFT", label: "Drafts" }];
const pill: Record<BlogStatus, string> = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SCHEDULED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  DRAFT: "bg-muted text-muted-foreground",
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function BlogWorkspace({ slug, data }: { slug: string; data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"ALL" | BlogStatus>("ALL");
  const [q, setQ] = useState("");
  const [catName, setCatName] = useState("");

  const counts = useMemo(() => ({ ALL: data.posts.length, PUBLISHED: data.posts.filter((p) => p.status === "PUBLISHED").length, SCHEDULED: data.posts.filter((p) => p.status === "SCHEDULED").length, DRAFT: data.posts.filter((p) => p.status === "DRAFT").length }), [data.posts]);
  const rows = data.posts.filter((p) => (tab === "ALL" || p.status === tab) && (!q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())));

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "Something went wrong");
      if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Newspaper className="h-3.5 w-3.5" />BizNest App</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Blog</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Write posts and guides that appear on your website at /blog, with categories, tags, scheduling and an RSS feed.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/store/${slug}/blog`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><ExternalLink className="h-4 w-4" />View blog</Link>
          <Link href={`/store/${slug}/blog/rss.xml`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><Rss className="h-4 w-4" />RSS</Link>
          <Link href={`/store/${slug}/admin/blog/new`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" />New post</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <div className="flex flex-wrap gap-1">
              {TABS.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{t.label} <span className="opacity-70">{counts[t.id]}</span></button>)}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className="w-full rounded-xl border bg-background px-3 py-1.5 text-sm outline-none sm:w-56" />
          </div>
          {rows.length === 0 ? (
            <div className="p-12 text-center">
              <Newspaper className="mx-auto h-9 w-9 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">{data.posts.length ? "No posts match" : "Write your first post"}</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{data.posts.length ? "Try another tab or search." : "Share a guide, an update or a story. Customers and search engines find it on your blog."}</p>
              {!data.posts.length && <Link href={`/store/${slug}/admin/blog/new`} className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">New post</Link>}
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                  {p.featuredImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.featuredImage} alt="" className="h-14 w-20 shrink-0 rounded-lg border object-cover" />
                    : <div className="grid h-14 w-20 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground"><Newspaper className="h-5 w-5" /></div>}
                  <div className="min-w-0 flex-1">
                    <Link href={`/store/${slug}/admin/blog/${p.id}`} className="line-clamp-1 font-semibold hover:underline">{p.isFeatured && <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-500" />}{p.title}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${pill[p.status]}`}>{p.status === "PUBLISHED" ? "Published" : p.status === "SCHEDULED" ? "Scheduled" : "Draft"}</span>
                      {p.publishedAt && p.status !== "DRAFT" && <span>{fmt(p.publishedAt)}</span>}
                      {p.category && <span>· {p.category.name}</span>}
                      <span>· {p.readingMinutes} min read</span>
                      <span>· {p.authorName}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link href={`/store/${slug}/admin/blog/${p.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></Link>
                    {p.status === "PUBLISHED" && <Link href={`/store/${slug}/blog/${p.slug}`} target="_blank" title="View" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="h-4 w-4" /></Link>}
                    <button type="button" disabled={pending} title="Duplicate" onClick={() => run(() => duplicateBlogPost(slug, p.id), "Copy created as a draft")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Copy className="h-4 w-4" /></button>
                    {p.status === "PUBLISHED"
                      ? <button type="button" disabled={pending} onClick={() => run(() => setBlogPostStatus(slug, p.id, "DRAFT"), "Moved to drafts")} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">Unpublish</button>
                      : <button type="button" disabled={pending} onClick={() => run(() => setBlogPostStatus(slug, p.id, "PUBLISHED"), "Post published")} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-muted">Publish</button>}
                    <button type="button" disabled={pending} title="Delete" onClick={() => { if (window.confirm(`Delete “${p.title}”? This cannot be undone.`)) run(() => deleteBlogPost(slug, p.id), "Post deleted"); }} className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-2xl border bg-background p-4">
          <h2 className="text-sm font-bold">Categories</h2>
          <ul className="mt-3 space-y-1">
            {data.categories.length === 0 && <li className="text-xs text-muted-foreground">No categories yet.</li>}
            {data.categories.map((c) => (
              <li key={c.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <span className="truncate">{c.name} <span className="text-xs text-muted-foreground">{c.count}</span></span>
                <span className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" title="Rename" onClick={() => { const n = window.prompt("Rename category", c.name); if (n && n.trim() !== c.name) run(() => renameBlogCategory(slug, c.id, n)); }} className="grid h-7 w-7 place-items-center rounded-md hover:bg-background"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" title="Delete" onClick={() => { if (window.confirm(`Delete the “${c.name}” category? Its posts stay, uncategorised.`)) run(() => deleteBlogCategory(slug, c.id)); }} className="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-background"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = catName.trim(); if (!n) return; run(() => createBlogCategory(slug, n)); setCatName(""); }}>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" maxLength={60} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-1.5 text-sm outline-none" />
            <button type="submit" disabled={pending || !catName.trim()} className="rounded-xl border px-3 text-xs font-semibold disabled:opacity-50">Add</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
