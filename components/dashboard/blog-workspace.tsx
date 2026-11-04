"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Newspaper, Pencil, Plus, Rss, Trash2 } from "lucide-react";
import { deleteArticles, duplicateArticle, setArticlesVisibility } from "@/lib/actions/blog";
import type { getBlogWorkspace } from "@/lib/actions/blog";
import type { Visibility } from "@/lib/blog";

type Data = NonNullable<Awaited<ReturnType<typeof getBlogWorkspace>>>;
const TABS: { id: "ALL" | Visibility; label: string }[] = [{ id: "ALL", label: "All" }, { id: "VISIBLE", label: "Visible" }, { id: "SCHEDULED", label: "Scheduled" }, { id: "HIDDEN", label: "Hidden" }];
const pill: Record<Visibility, string> = {
  VISIBLE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SCHEDULED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  HIDDEN: "bg-muted text-muted-foreground",
};
const label: Record<Visibility, string> = { VISIBLE: "Visible", SCHEDULED: "Scheduled", HIDDEN: "Hidden" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

/** Shopify's "Blog posts" screen: one list of articles across every blog, filtered by visibility, blog, tag and search. */
export function BlogWorkspace({ slug, data }: { slug: string; data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"ALL" | Visibility>("ALL");
  const [blogId, setBlogId] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const counts = useMemo(() => ({
    ALL: data.articles.length,
    VISIBLE: data.articles.filter((p) => p.visibility === "VISIBLE").length,
    SCHEDULED: data.articles.filter((p) => p.visibility === "SCHEDULED").length,
    HIDDEN: data.articles.filter((p) => p.visibility === "HIDDEN").length,
  }), [data.articles]);
  const allTags = useMemo(() => [...new Set(data.articles.flatMap((a) => a.tags))].sort((x, y) => x.localeCompare(y)), [data.articles]);
  const rows = data.articles.filter((p) =>
    (tab === "ALL" || p.visibility === tab) && (!blogId || p.blog.id === blogId) && (!tag || p.tags.includes(tag)) &&
    (!q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())));
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "Something went wrong");
      if (ok) toast.success(ok);
      setSelected([]);
      router.refresh();
    });

  const first = data.blogs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Newspaper className="h-3.5 w-3.5" />BizNest App</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Blog posts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Articles live inside blogs. Organise them with tags, and choose whether each is visible, hidden or scheduled.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {first && <Link href={`/store/${slug}/blogs/${first.handle}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><ExternalLink className="h-4 w-4" />View blog</Link>}
          <Link href={`/store/${slug}/blog/rss.xml`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><Rss className="h-4 w-4" />RSS</Link>
          <Link href={`/store/${slug}/admin/blog/blogs`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold">Manage blogs</Link>
          <Link href={`/store/${slug}/admin/blog/new`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Add blog post</Link>
        </div>
      </div>

      <section className="rounded-2xl border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{t.label} <span className="opacity-70">{counts[t.id]}</span></button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.blogs.length > 1 && (
              <select value={blogId} onChange={(e) => setBlogId(e.target.value)} className="rounded-xl border bg-background px-3 py-1.5 text-sm" aria-label="Filter by blog">
                <option value="">All blogs</option>
                {data.blogs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            )}
            {allTags.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-xl border bg-background px-3 py-1.5 text-sm" aria-label="Filter by tag">
                <option value="">All tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className="w-full rounded-xl border bg-background px-3 py-1.5 text-sm outline-none sm:w-52" />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
            <strong>{selected.length} selected</strong>
            <button type="button" disabled={pending} onClick={() => run(() => setArticlesVisibility(slug, selected, "VISIBLE"), "Updated")} className="rounded-lg border bg-background px-3 py-1.5 font-semibold">Make visible</button>
            <button type="button" disabled={pending} onClick={() => run(() => setArticlesVisibility(slug, selected, "HIDDEN"), "Updated")} className="rounded-lg border bg-background px-3 py-1.5 font-semibold">Make hidden</button>
            <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Delete ${selected.length} article${selected.length === 1 ? "" : "s"}? This cannot be undone.`)) run(() => deleteArticles(slug, selected), "Deleted"); }} className="rounded-lg border border-red-500/40 bg-background px-3 py-1.5 font-semibold text-red-600">Delete</button>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <Newspaper className="mx-auto h-9 w-9 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">{data.articles.length ? "No articles match" : "Write your first blog post"}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{data.articles.length ? "Try another tab, filter or search." : "Share a guide, an update or a story. Customers and search engines find it on your blog."}</p>
            {!data.articles.length && <Link href={`/store/${slug}/admin/blog/new`} className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add blog post</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))} /></th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Blog</th>
                  <th className="p-3">Author</th>
                  <th className="p-3">Visibility</th>
                  <th className="p-3">Tags</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => (
                  <tr key={p.id} className="align-middle hover:bg-muted/30">
                    <td className="p-3"><input type="checkbox" aria-label={`Select ${p.title}`} checked={selected.includes(p.id)} onChange={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded-md border object-cover" />
                          : <div className="grid h-10 w-14 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"><Newspaper className="h-4 w-4" /></div>}
                        <div className="min-w-0">
                          <Link href={`/store/${slug}/admin/blog/${p.id}`} className="line-clamp-1 font-semibold hover:underline">{p.title}</Link>
                          <div className="text-xs text-muted-foreground">{p.readingMinutes} min read</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.blog.title}</td>
                    <td className="p-3 text-muted-foreground">{p.authorName}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill[p.visibility]}`}>{label[p.visibility]}</span>
                      {p.publishedAt && p.visibility !== "HIDDEN" && <div className="mt-1 text-xs text-muted-foreground">{fmt(p.publishedAt)}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{p.tags.slice(0, 3).join(", ")}{p.tags.length > 3 ? ` +${p.tags.length - 3}` : ""}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/store/${slug}/admin/blog/${p.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></Link>
                        {p.visibility === "VISIBLE" && <Link href={`/store/${slug}/blogs/${p.blog.handle}/${p.handle}`} target="_blank" title="View" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="h-4 w-4" /></Link>}
                        <button type="button" disabled={pending} title="Duplicate" onClick={() => run(() => duplicateArticle(slug, p.id), "Copy created as hidden")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Copy className="h-4 w-4" /></button>
                        <button type="button" disabled={pending} title="Delete" onClick={() => { if (window.confirm(`Delete “${p.title}”? This cannot be undone.`)) run(() => deleteArticles(slug, [p.id]), "Article deleted"); }} className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
