"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";
import {
  DEFAULT_BLOG, blogHandle, normaliseTags, readingMinutes, resolvePublishedAt, visibilityOf, type Visibility,
} from "@/lib/blog";
import { safeSrc } from "@/lib/blog-markdown";

async function access(slug: string) {
  // Posts are core: any owner, or staff who can manage marketing, may write them.
  return assertStorePermission(slug, "marketing");
}

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const optStr = (v: unknown, max: number) => str(v, max) || null;

function refresh(slug: string, blog?: string, article?: string) {
  revalidatePath(`/store/${slug}/admin/blog`);
  revalidatePath(`/store/${slug}/blog`);
  revalidatePath(`/store/${slug}/blogs`, "layout");
  if (blog) revalidatePath(`/store/${slug}/blogs/${blog}`);
  if (blog && article) revalidatePath(`/store/${slug}/blogs/${blog}/${article}`);
  if (article) revalidatePath(`/store/${slug}/blog/${article}`);
  revalidatePath(`/store/${slug}/blog/rss.xml`);
  revalidatePath(`/store/${slug}/sitemap.xml`);
}

/** Every store with the Blog app has at least one blog, like Shopify's default "News". Created on first use. */
async function ensureDefaultBlog(storeId: string) {
  const first = await prisma.blog.findFirst({ where: { storeId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (first) return first;
  return prisma.blog.upsert({
    where: { storeId_handle: { storeId, handle: DEFAULT_BLOG.handle } },
    update: {},
    create: { storeId, title: DEFAULT_BLOG.title, handle: DEFAULT_BLOG.handle },
    select: { id: true },
  });
}

async function uniqueArticleHandle(blogId: string, base: string, excludeId?: string) {
  const root = base || "article";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root.slice(0, 74)}-${n + 1}`;
    const clash = await prisma.article.findFirst({ where: { blogId, handle: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root.slice(0, 60)}-${Date.now().toString(36)}`;
}

async function uniqueBlogHandle(storeId: string, base: string, excludeId?: string) {
  const root = base || "blog";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root.slice(0, 74)}-${n + 1}`;
    const clash = await prisma.blog.findFirst({ where: { storeId, handle: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root.slice(0, 60)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------- reads

/** "Blog posts" list: every article across the store's blogs, plus the blogs themselves for filtering. */
export async function getBlogWorkspace(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const storeId = a.store.id;
  await ensureDefaultBlog(storeId);
  const [articles, blogs] = await Promise.all([
    prisma.article.findMany({
      where: { storeId }, orderBy: [{ updatedAt: "desc" }], take: 500,
      select: { id: true, title: true, handle: true, publishedAt: true, updatedAt: true, readingMinutes: true, imageUrl: true, authorName: true, tags: true, blog: { select: { id: true, title: true, handle: true } } },
    }),
    prisma.blog.findMany({ where: { storeId }, orderBy: { createdAt: "asc" }, include: { _count: { select: { articles: true } } } }),
  ]);
  const now = new Date();
  return {
    store: { slug: a.store.slug, name: a.store.name },
    articles: articles.map((p) => ({
      id: p.id, title: p.title, handle: p.handle, visibility: visibilityOf(p.publishedAt, now),
      publishedAt: p.publishedAt?.toISOString() ?? null, updatedAt: p.updatedAt.toISOString(),
      readingMinutes: p.readingMinutes, imageUrl: p.imageUrl, authorName: p.authorName, tags: p.tags, blog: p.blog,
    })),
    blogs: blogs.map((b) => ({ id: b.id, title: b.title, handle: b.handle, count: b._count.articles })),
  };
}

export async function getBlogEditorData(slug: string, articleId?: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const defaultBlog = await ensureDefaultBlog(a.store.id);
  const [blogs, allTags] = await Promise.all([
    prisma.blog.findMany({ where: { storeId: a.store.id }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, handle: true } }),
    prisma.article.findMany({ where: { storeId: a.store.id }, select: { tags: true }, take: 500 }),
  ]);
  const tagSuggestions = [...new Set(allTags.flatMap((t) => t.tags))].sort((x, y) => x.localeCompare(y)).slice(0, 100);
  const base = { storeSlug: a.store.slug, storeName: a.store.name, blogs, tagSuggestions, defaultBlogId: defaultBlog.id };
  if (!articleId) return { ...base, article: null };
  const p = await prisma.article.findFirst({ where: { id: articleId, storeId: a.store.id }, include: { blog: { select: { handle: true } } } });
  if (!p) return null;
  return {
    ...base,
    article: {
      id: p.id, blogId: p.blogId, blogHandle: p.blog.handle, title: p.title, handle: p.handle, excerpt: p.excerpt ?? "", body: p.body, tags: p.tags,
      imageUrl: p.imageUrl ?? "", imageAlt: p.imageAlt ?? "", authorName: p.authorName,
      visibility: visibilityOf(p.publishedAt), publishedAt: p.publishedAt?.toISOString() ?? null,
      seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    },
  };
}

// ---------------------------------------------------------------- articles

export type ArticleInput = {
  id?: string; blogId: string; title: string; handle?: string; excerpt?: string; body: string; tags?: string[] | string;
  imageUrl?: string; imageAlt?: string; authorName?: string; seoTitle?: string; seoDescription?: string;
  visibility: Visibility; /** ISO date. With Visible it back-dates or schedules the article; with Scheduled it is required. */ publishDate?: string | null;
};

export async function saveArticle(slug: string, input: ArticleInput): Promise<ActionResult<{ id: string; handle: string; blogHandle: string; visibility: Visibility; publishedAt: string | null }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const session = await auth();
  const userId = session?.user?.id ?? "anon";
  const rl = await checkRateLimit(`blog:save:${userId}`, 120, 10 * 60 * 1000);
  if (!rl.allowed) return fail("You're saving too quickly. Wait a moment and try again.");

  const title = str(input.title, 150);
  if (!title) return fail("Give the article a title.");
  const body = String(input.body ?? "").slice(0, 120_000);
  if (input.visibility !== "HIDDEN" && body.trim().length < 20) return fail("Write something in the article before making it visible.");
  if (!["VISIBLE", "HIDDEN", "SCHEDULED"].includes(input.visibility)) return fail("Unknown visibility.");

  const blog = await prisma.blog.findFirst({ where: { id: input.blogId, storeId: a.store.id }, select: { id: true, handle: true } });
  if (!blog) return fail("Choose a blog for this article.");

  const image = str(input.imageUrl, 600);
  if (image && !safeSrc(image)) return fail("The image must be an https link or an uploaded image.");

  const existing = input.id ? await prisma.article.findFirst({ where: { id: input.id, storeId: a.store.id }, select: { id: true, handle: true, blogId: true, publishedAt: true } }) : null;
  if (input.id && !existing) return fail("Article not found.");

  const publishDate = input.publishDate ? new Date(input.publishDate) : null;
  if (input.visibility === "SCHEDULED") {
    if (!publishDate || Number.isNaN(publishDate.getTime())) return fail("Choose a date and time to schedule this article.");
    if (publishDate.getTime() <= Date.now()) return fail("The scheduled time must be in the future.");
  }
  const resolved = resolvePublishedAt(input.visibility, publishDate, existing?.publishedAt ?? null);
  if ("error" in resolved) return fail(resolved.error);

  const wanted = blogHandle(str(input.handle, 120) || title);
  const moved = !!existing && existing.blogId !== blog.id;
  let handle: string;
  if (existing && !moved && wanted === existing.handle) handle = existing.handle;
  else if (existing && input.handle?.trim()) {
    // The owner typed this URL handle on purpose, so a clash is an error rather than a silent rename.
    const clash = await prisma.article.findFirst({ where: { blogId: blog.id, handle: wanted, id: { not: existing.id } }, select: { id: true } });
    if (clash) return fail("Another article in this blog already uses that URL handle.");
    handle = wanted;
  } else handle = await uniqueArticleHandle(blog.id, wanted, existing?.id);

  const data = {
    blogId: blog.id, title, handle, excerpt: optStr(input.excerpt, 300), body, tags: normaliseTags(input.tags),
    imageUrl: image || null, imageAlt: optStr(input.imageAlt, 160),
    seoTitle: optStr(input.seoTitle, 70), seoDescription: optStr(input.seoDescription, 170),
    publishedAt: resolved.publishedAt, readingMinutes: readingMinutes(body),
  };
  const author = str(input.authorName, 80);

  try {
    const saved = existing
      ? await prisma.article.update({ where: { id: existing.id }, data: { ...data, ...(author ? { authorName: author } : {}) }, select: { id: true, handle: true } })
      : await prisma.article.create({ data: { ...data, storeId: a.store.id, authorId: session?.user?.id ?? null, authorName: author || str(session?.user?.name, 80) || a.store.name }, select: { id: true, handle: true } });
    refresh(slug, blog.handle, saved.handle);
    if (existing && (existing.handle !== saved.handle || moved)) refresh(slug, undefined, existing.handle);
    return { success: true, data: { id: saved.id, handle: saved.handle, blogHandle: blog.handle, visibility: visibilityOf(resolved.publishedAt), publishedAt: resolved.publishedAt?.toISOString() ?? null } };
  } catch (e: any) {
    if (e?.code === "P2002") return fail("Another article in this blog already uses that URL handle.");
    return fail("The article could not be saved. Please try again.");
  }
}

/** Bulk "Make visible / Make hidden" from the list. */
export async function setArticlesVisibility(slug: string, ids: string[], visibility: "VISIBLE" | "HIDDEN"): Promise<ActionResult<{ updated: number }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const rows = await prisma.article.findMany({ where: { id: { in: ids.slice(0, 200) }, storeId: a.store.id }, select: { id: true, body: true, publishedAt: true } });
  let updated = 0;
  for (const r of rows) {
    if (visibility === "VISIBLE" && r.body.trim().length < 20) continue;
    const next = visibility === "HIDDEN" ? null : r.publishedAt && r.publishedAt <= new Date() ? r.publishedAt : new Date();
    await prisma.article.update({ where: { id: r.id }, data: { publishedAt: next } });
    updated++;
  }
  refresh(slug);
  return { success: true, data: { updated } };
}

export async function duplicateArticle(slug: string, id: string): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const p = await prisma.article.findFirst({ where: { id, storeId: a.store.id } });
  if (!p) return fail("Article not found.");
  const session = await auth();
  const copy = await prisma.article.create({
    data: {
      storeId: a.store.id, blogId: p.blogId, title: `${p.title} (copy)`.slice(0, 150), handle: await uniqueArticleHandle(p.blogId, blogHandle(`${p.title} copy`)),
      excerpt: p.excerpt, body: p.body, tags: p.tags, imageUrl: p.imageUrl, imageAlt: p.imageAlt,
      authorId: session?.user?.id ?? null, authorName: str(session?.user?.name, 80) || p.authorName, publishedAt: null,
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, readingMinutes: p.readingMinutes,
    },
    select: { id: true },
  });
  refresh(slug);
  return { success: true, data: { id: copy.id } };
}

export async function deleteArticles(slug: string, ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const rows = await prisma.article.findMany({ where: { id: { in: ids.slice(0, 200) }, storeId: a.store.id }, select: { id: true } });
  await prisma.article.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  refresh(slug);
  return { success: true, data: { deleted: rows.length } };
}

// ---------------------------------------------------------------- blogs ("Manage blogs")

export async function createBlog(slug: string, title: string): Promise<ActionResult<{ id: string; title: string; handle: string }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const clean = str(title, 60);
  if (!clean) return fail("Give the blog a title.");
  const created = await prisma.blog.create({ data: { storeId: a.store.id, title: clean, handle: await uniqueBlogHandle(a.store.id, blogHandle(clean)) }, select: { id: true, title: true, handle: true } });
  refresh(slug, created.handle);
  return { success: true, data: created };
}

/** Rename a blog. Its URL handle only changes when `handle` is given, so existing links keep working. */
export async function updateBlog(slug: string, id: string, patch: { title?: string; handle?: string }): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const blog = await prisma.blog.findFirst({ where: { id, storeId: a.store.id }, select: { id: true, handle: true } });
  if (!blog) return fail("Blog not found.");
  const data: { title?: string; handle?: string } = {};
  if (patch.title !== undefined) {
    const t = str(patch.title, 60);
    if (!t) return fail("Give the blog a title.");
    data.title = t;
  }
  if (patch.handle !== undefined) {
    const h = blogHandle(patch.handle);
    if (!h) return fail("Enter a URL handle.");
    const clash = await prisma.blog.findFirst({ where: { storeId: a.store.id, handle: h, id: { not: id } }, select: { id: true } });
    if (clash) return fail("Another blog already uses that URL handle.");
    data.handle = h;
  }
  await prisma.blog.update({ where: { id }, data });
  refresh(slug, blog.handle);
  if (data.handle) refresh(slug, data.handle);
  return { success: true, data: undefined };
}

/** Deleting a blog deletes its articles (as in Shopify). The last remaining blog cannot be deleted. */
export async function deleteBlog(slug: string, id: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const blog = await prisma.blog.findFirst({ where: { id, storeId: a.store.id }, select: { id: true, handle: true } });
  if (!blog) return fail("Blog not found.");
  if ((await prisma.blog.count({ where: { storeId: a.store.id } })) <= 1) return fail("A store needs at least one blog. Rename this one instead.");
  await prisma.blog.delete({ where: { id } });
  refresh(slug, blog.handle);
  return { success: true, data: undefined };
}
