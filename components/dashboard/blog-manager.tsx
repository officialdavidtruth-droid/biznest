"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { createBlog, deleteBlog, updateBlog } from "@/lib/actions/blog";
import type { getBlogWorkspace } from "@/lib/actions/blog";

type Data = NonNullable<Awaited<ReturnType<typeof getBlogWorkspace>>>;

/** Shopify's "Manage blogs": the containers articles belong to. */
export function BlogManager({ slug, data }: { slug: string; data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "Something went wrong");
      if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/store/${slug}/admin/blog`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Blog posts</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Blogs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each blog has its own address, like /blogs/news. Your first blog is also shown at /blog.</p>
      </div>

      <section className="rounded-2xl border bg-background">
        <ul className="divide-y">
          {data.blogs.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{b.title}{i === 0 && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Main blog</span>}</div>
                <div className="text-xs text-muted-foreground">/blogs/{b.handle} · {b.count} {b.count === 1 ? "article" : "articles"}</div>
              </div>
              <Link href={`/store/${slug}/blogs/${b.handle}`} target="_blank" title="View" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="h-4 w-4" /></Link>
              <button type="button" title="Rename" disabled={pending} onClick={() => { const n = window.prompt("Blog title", b.title); if (n && n.trim() !== b.title) run(() => updateBlog(slug, b.id, { title: n }), "Blog renamed"); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>
              <button type="button" disabled={pending} onClick={() => { const h = window.prompt("URL handle (changing it breaks old links)", b.handle); if (h && h.trim() !== b.handle) run(() => updateBlog(slug, b.id, { handle: h }), "URL handle updated"); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">Edit handle</button>
              <button type="button" title="Delete" disabled={pending || data.blogs.length <= 1} onClick={() => { if (window.confirm(`Delete the “${b.title}” blog and its ${b.count} article${b.count === 1 ? "" : "s"}? This cannot be undone.`)) run(() => deleteBlog(slug, b.id), "Blog deleted"); }} className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2 border-t p-4" onSubmit={(e) => { e.preventDefault(); const n = title.trim(); if (!n) return; run(() => createBlog(slug, n), "Blog created"); setTitle(""); }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New blog title, e.g. Guides" maxLength={60} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
          <button type="submit" disabled={pending || !title.trim()} className="rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">Add blog</button>
        </form>
      </section>
    </div>
  );
}
