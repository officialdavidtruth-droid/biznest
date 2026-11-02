"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";
import {
  BLOG_PLUGIN_KEY, BLOG_STATUSES, blogSlug, effectiveStatus, normaliseTags, readingMinutes, resolveStatus, type BlogStatus,
} from "@/lib/blog";
import { safeSrc } from "@/lib/blog-markdown";

async function access(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${BLOG_PLUGIN_KEY}`);
  if (!a.success) return a;
  const ent = await getPluginEntitlement(a.store.id, BLOG_PLUGIN_KEY);
  if (!ent.allowed) return { success: false as const, error: ent.reason };
  if (!ent.installed) return { success: false as const, error: "Install the Blog app from Apps to publish posts." };
  return a;
}

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const optStr = (v: unknown, max: number) => str(v, max) || null;

function refresh(slug: string, postSlug?: string) {
  revalidatePath(`/store/${slug}/admin/blog`);
  revalidatePath(`/store/${slug}/blog`);
  if (postSlug) revalidatePath(`/store/${slug}/blog/${postSlug}`);
  revalidatePath(`/store/${slug}/blog/rss.xml`);
  revalidatePath(`/store/${slug}/sitemap.xml`);
}

async function uniqueSlug(storeId: string, base: string, excludeId?: string) {
  const root = base || "post";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root.slice(0, 74)}-${n + 1}`;
    const clash = await prisma.blogPost.findFirst({ where: { storeId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root.slice(0, 60)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------- reads

export async function getBlogWorkspace(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const storeId = a.store.id;
  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({
      where: { storeId }, orderBy: [{ updatedAt: "desc" }], take: 500,
      select: { id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true, isFeatured: true, readingMinutes: true, featuredImage: true, authorName: true, tags: true, category: { select: { id: true, name: true } } },
    }),
    prisma.blogCategory.findMany({ where: { storeId }, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } }),
  ]);
  const now = new Date();
  return {
    store: { slug: a.store.slug, name: a.store.name },
    posts: posts.map((p) => ({
      id: p.id, title: p.title, slug: p.slug, status: effectiveStatus({ status: p.status as BlogStatus, publishedAt: p.publishedAt }, now), scheduled: p.status === "SCHEDULED" && !!p.publishedAt && p.publishedAt > now,
      publishedAt: p.publishedAt?.toISOString() ?? null, updatedAt: p.updatedAt.toISOString(), isFeatured: p.isFeatured,
      readingMinutes: p.readingMinutes, featuredImage: p.featuredImage, authorName: p.authorName, tags: p.tags, category: p.category,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c._count.posts })),
  };
}

export async function getBlogEditorData(slug: string, postId?: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const categories = await prisma.blogCategory.findMany({ where: { storeId: a.store.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (!postId) return { storeSlug: a.store.slug, storeName: a.store.name, categories, post: null };
  const p = await prisma.blogPost.findFirst({ where: { id: postId, storeId: a.store.id } });
  if (!p) return null;
  return {
    storeSlug: a.store.slug, storeName: a.store.name, categories,
    post: {
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", body: p.body, tags: p.tags, categoryId: p.categoryId ?? "",
      featuredImage: p.featuredImage ?? "", featuredImageAlt: p.featuredImageAlt ?? "", isFeatured: p.isFeatured,
      status: effectiveStatus({ status: p.status as BlogStatus, publishedAt: p.publishedAt }), publishedAt: p.publishedAt?.toISOString() ?? null,
      seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    },
  };
}

// ---------------------------------------------------------------- posts

export type BlogPostInput = {
  id?: string; title: string; slug?: string; excerpt?: string; body: string; tags?: string[] | string; categoryId?: string;
  featuredImage?: string; featuredImageAlt?: string; isFeatured?: boolean; seoTitle?: string; seoDescription?: string;
  intent: BlogStatus; scheduledFor?: string | null;
};

export async function saveBlogPost(slug: string, input: BlogPostInput): Promise<ActionResult<{ id: string; slug: string; status: BlogStatus }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const session = await auth();
  const userId = session?.user?.id ?? "anon";
  const rl = await checkRateLimit(`blog:save:${userId}`, 120, 10 * 60 * 1000);
  if (!rl.allowed) return fail("You're saving too quickly. Wait a moment and try again.");

  const title = str(input.title, 150);
  if (!title) return fail("Give the post a title.");
  const body = String(input.body ?? "").slice(0, 120_000);
  if (input.intent !== "DRAFT" && body.trim().length < 20) return fail("Write something in the post before publishing it.");
  if (!BLOG_STATUSES.includes(input.intent)) return fail("Unknown post status.");

  let categoryId: string | null = null;
  if (input.categoryId) {
    const cat = await prisma.blogCategory.findFirst({ where: { id: input.categoryId, storeId: a.store.id }, select: { id: true } });
    if (!cat) return fail("That category no longer exists.");
    categoryId = cat.id;
  }

  const image = str(input.featuredImage, 600);
  if (image && !safeSrc(image)) return fail("The featured image must be an https link or an uploaded image.");

  const existing = input.id ? await prisma.blogPost.findFirst({ where: { id: input.id, storeId: a.store.id }, select: { id: true, slug: true, status: true, publishedAt: true } }) : null;
  if (input.id && !existing) return fail("Post not found.");

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) return fail("That scheduled date is not valid.");
  const resolved = resolveStatus(input.intent, scheduledFor, existing ? { status: existing.status as BlogStatus, publishedAt: existing.publishedAt } : null);
  if ("error" in resolved) return fail(resolved.error);

  const wanted = blogSlug(str(input.slug, 120) || title);
  let postSlug: string;
  if (existing && wanted === existing.slug) postSlug = existing.slug;
  else if (existing && input.slug?.trim()) {
    // The owner typed this address on purpose, so a clash is an error rather than a silent rename.
    const clash = await prisma.blogPost.findFirst({ where: { storeId: a.store.id, slug: wanted, id: { not: existing.id } }, select: { id: true } });
    if (clash) return fail("Another post already uses that address. Choose a different one.");
    postSlug = wanted;
  } else postSlug = await uniqueSlug(a.store.id, wanted, existing?.id);

  const data = {
    title, slug: postSlug, excerpt: optStr(input.excerpt, 300), body, tags: normaliseTags(input.tags), categoryId,
    featuredImage: image || null, featuredImageAlt: optStr(input.featuredImageAlt, 160), isFeatured: !!input.isFeatured,
    seoTitle: optStr(input.seoTitle, 70), seoDescription: optStr(input.seoDescription, 170),
    status: resolved.status, publishedAt: resolved.publishedAt, readingMinutes: readingMinutes(body),
  };

  try {
    const saved = existing
      ? await prisma.blogPost.update({ where: { id: existing.id }, data, select: { id: true, slug: true } })
      : await prisma.blogPost.create({ data: { ...data, storeId: a.store.id, authorId: session?.user?.id ?? null, authorName: str(session?.user?.name, 80) || a.store.name }, select: { id: true, slug: true } });
    refresh(slug, saved.slug);
    if (existing && existing.slug !== saved.slug) revalidatePath(`/store/${slug}/blog/${existing.slug}`);
    return { success: true, data: { id: saved.id, slug: saved.slug, status: resolved.status } };
  } catch (e: any) {
    if (e?.code === "P2002") return fail("Another post already uses that address. Choose a different one.");
    return fail("The post could not be saved. Please try again.");
  }
}

export async function setBlogPostStatus(slug: string, id: string, intent: "PUBLISHED" | "DRAFT"): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const p = await prisma.blogPost.findFirst({ where: { id, storeId: a.store.id }, select: { id: true, slug: true, body: true, status: true, publishedAt: true } });
  if (!p) return fail("Post not found.");
  if (intent === "PUBLISHED" && p.body.trim().length < 20) return fail("Write something in the post before publishing it.");
  const r = resolveStatus(intent, null, { status: p.status as BlogStatus, publishedAt: p.publishedAt });
  if ("error" in r) return fail(r.error);
  await prisma.blogPost.update({ where: { id: p.id }, data: { status: r.status, publishedAt: r.publishedAt } });
  refresh(slug, p.slug);
  return { success: true, data: undefined };
}

export async function duplicateBlogPost(slug: string, id: string): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const p = await prisma.blogPost.findFirst({ where: { id, storeId: a.store.id } });
  if (!p) return fail("Post not found.");
  const session = await auth();
  const copy = await prisma.blogPost.create({
    data: {
      storeId: a.store.id, categoryId: p.categoryId, title: `${p.title} (copy)`.slice(0, 150), slug: await uniqueSlug(a.store.id, blogSlug(`${p.title} copy`)),
      excerpt: p.excerpt, body: p.body, tags: p.tags, featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt,
      authorId: session?.user?.id ?? null, authorName: str(session?.user?.name, 80) || a.store.name, status: "DRAFT", publishedAt: null,
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, readingMinutes: p.readingMinutes,
    },
    select: { id: true },
  });
  refresh(slug);
  return { success: true, data: { id: copy.id } };
}

export async function deleteBlogPost(slug: string, id: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const p = await prisma.blogPost.findFirst({ where: { id, storeId: a.store.id }, select: { id: true, slug: true } });
  if (!p) return fail("Post not found.");
  await prisma.blogPost.delete({ where: { id: p.id } });
  refresh(slug, p.slug);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------- categories

export async function createBlogCategory(slug: string, name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const clean = str(name, 60);
  if (!clean) return fail("Give the category a name.");
  const catSlug = blogSlug(clean) || "category";
  const existing = await prisma.blogCategory.findUnique({ where: { storeId_slug: { storeId: a.store.id, slug: catSlug } }, select: { id: true, name: true } });
  if (existing) return { success: true, data: existing };
  const created = await prisma.blogCategory.create({ data: { storeId: a.store.id, name: clean, slug: catSlug }, select: { id: true, name: true } });
  refresh(slug);
  return { success: true, data: created };
}

export async function renameBlogCategory(slug: string, id: string, name: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const clean = str(name, 60);
  if (!clean) return fail("Give the category a name.");
  const cat = await prisma.blogCategory.findFirst({ where: { id, storeId: a.store.id }, select: { id: true } });
  if (!cat) return fail("Category not found.");
  const catSlug = blogSlug(clean) || "category";
  const clash = await prisma.blogCategory.findFirst({ where: { storeId: a.store.id, slug: catSlug, id: { not: id } }, select: { id: true } });
  if (clash) return fail("A category with that name already exists.");
  await prisma.blogCategory.update({ where: { id }, data: { name: clean, slug: catSlug } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function deleteBlogCategory(slug: string, id: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return fail(a.error);
  const cat = await prisma.blogCategory.findFirst({ where: { id, storeId: a.store.id }, select: { id: true } });
  if (!cat) return fail("Category not found.");
  await prisma.blogCategory.delete({ where: { id } }); // posts keep existing, uncategorised (onDelete: SetNull)
  refresh(slug);
  return { success: true, data: undefined };
}
