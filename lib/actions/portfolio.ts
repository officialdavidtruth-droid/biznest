"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import {
  MAX_PORTFOLIO_ALBUMS, MAX_PORTFOLIO_IMAGES, cleanText, isPortfolioImageUrl, uniqueAlbumSlug,
} from "@/lib/portfolio";
import type { ActionResult } from "@/types/actions";

export type PortfolioImageDTO = { id: string; url: string; caption: string | null };
export type PortfolioAlbumDTO = {
  id: string; title: string; slug: string; category: string | null; description: string | null; coverUrl: string | null;
  isPublished: boolean; images: PortfolioImageDTO[];
};

type AlbumRow = { id: string; title: string; slug: string; category: string | null; description: string | null; coverUrl: string | null; isPublished: boolean; images: { id: string; url: string; caption: string | null }[] };
const toDTO = (a: AlbumRow): PortfolioAlbumDTO => ({
  id: a.id, title: a.title, slug: a.slug, category: a.category, description: a.description, coverUrl: a.coverUrl, isPublished: a.isPublished,
  images: a.images.map((i) => ({ id: i.id, url: i.url, caption: i.caption })),
});

const imageOrder = { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }], select: { id: true, url: true, caption: true } };

function refresh(slug: string, albumSlug?: string) {
  revalidatePath(`/store/${slug}/portfolio`);
  if (albumSlug) revalidatePath(`/store/${slug}/portfolio/${albumSlug}`);
  revalidatePath(`/store/${slug}/admin/portfolio`);
}

async function ownedAlbum(storeId: string, id: string) {
  return prisma.portfolioAlbum.findFirst({ where: { id, storeId }, select: { id: true, slug: true, coverUrl: true, _count: { select: { images: true } } } });
}

export async function listPortfolioAlbums(slug: string): Promise<{ albums: PortfolioAlbumDTO[] } | { error: string }> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { error: a.error };
  const rows = await prisma.portfolioAlbum.findMany({
    where: { storeId: a.store.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, slug: true, category: true, description: true, coverUrl: true, isPublished: true, images: imageOrder },
  });
  return { albums: rows.map(toDTO) };
}

export async function createPortfolioAlbum(slug: string, input: { title: string; category?: string; description?: string }): Promise<ActionResult<PortfolioAlbumDTO>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const title = cleanText(input.title, 80);
  if (!title) return { success: false, error: "Give the album a name, like Weddings." };
  const existing = await prisma.portfolioAlbum.findMany({ where: { storeId: a.store.id }, select: { slug: true, sortOrder: true } });
  if (existing.length >= MAX_PORTFOLIO_ALBUMS) return { success: false, error: `You can have up to ${MAX_PORTFOLIO_ALBUMS} albums.` };
  const albumSlug = uniqueAlbumSlug(title, existing.map((e) => e.slug));
  const sortOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;
  try {
    const row = await prisma.portfolioAlbum.create({
      data: { storeId: a.store.id, title, slug: albumSlug, sortOrder, category: cleanText(input.category, 40) || null, description: cleanText(input.description, 500) || null },
      select: { id: true, title: true, slug: true, category: true, description: true, coverUrl: true, isPublished: true, images: imageOrder },
    });
    refresh(slug, albumSlug);
    return { success: true, data: toDTO(row) };
  } catch (err) {
    // Two requests picked the same slug at once: the unique index stopped the second one.
    if ((err as { code?: string }).code === "P2002") return { success: false, error: "That album name was just taken. Try again." };
    return { success: false, error: "Could not create the album." };
  }
}

export async function updatePortfolioAlbum(slug: string, id: string, input: { title?: string; category?: string; description?: string; isPublished?: boolean }): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const album = await ownedAlbum(a.store.id, id);
  if (!album) return { success: false, error: "Album not found." };
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = cleanText(input.title, 80);
    if (!title) return { success: false, error: "The album needs a name." };
    data.title = title; // The web address stays the same so links people already shared keep working.
  }
  if (input.category !== undefined) data.category = cleanText(input.category, 40) || null;
  if (input.description !== undefined) data.description = cleanText(input.description, 500) || null;
  if (input.isPublished !== undefined) data.isPublished = !!input.isPublished;
  await prisma.portfolioAlbum.update({ where: { id }, data });
  refresh(slug, album.slug);
  return { success: true, data: undefined };
}

export async function deletePortfolioAlbum(slug: string, id: string): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const album = await ownedAlbum(a.store.id, id);
  if (!album) return { success: false, error: "Album not found." };
  await prisma.portfolioAlbum.delete({ where: { id } });
  refresh(slug, album.slug);
  return { success: true, data: undefined };
}

/** Adds uploaded images (see /api/upload) to an album. The first image becomes the cover if there isn't one yet. */
export async function addPortfolioImages(slug: string, id: string, urls: string[]): Promise<ActionResult<{ album: PortfolioAlbumDTO }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const album = await ownedAlbum(a.store.id, id);
  if (!album) return { success: false, error: "Album not found." };
  const clean = Array.from(new Set((Array.isArray(urls) ? urls : []).filter(isPortfolioImageUrl)));
  if (!clean.length) return { success: false, error: "Those photos couldn't be used. Upload them again." };
  const room = MAX_PORTFOLIO_IMAGES - album._count.images;
  if (room <= 0) return { success: false, error: `An album can hold up to ${MAX_PORTFOLIO_IMAGES} photos.` };
  const accepted = clean.slice(0, room);
  const last = await prisma.portfolioImage.findFirst({ where: { albumId: id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const start = (last?.sortOrder ?? -1) + 1;
  await prisma.portfolioImage.createMany({ data: accepted.map((url, n) => ({ albumId: id, url, sortOrder: start + n })) });
  if (!album.coverUrl) await prisma.portfolioAlbum.update({ where: { id }, data: { coverUrl: accepted[0] } });
  const row = await prisma.portfolioAlbum.findUniqueOrThrow({ where: { id }, select: { id: true, title: true, slug: true, category: true, description: true, coverUrl: true, isPublished: true, images: imageOrder } });
  refresh(slug, album.slug);
  return { success: true, data: { album: toDTO(row) } };
}

export async function removePortfolioImage(slug: string, imageId: string): Promise<ActionResult<{ album: PortfolioAlbumDTO }>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const img = await prisma.portfolioImage.findFirst({ where: { id: imageId, album: { storeId: a.store.id } }, select: { id: true, url: true, albumId: true, album: { select: { slug: true, coverUrl: true } } } });
  if (!img) return { success: false, error: "Photo not found." };
  await prisma.portfolioImage.delete({ where: { id: img.id } });
  if (img.album.coverUrl === img.url) {
    const next = await prisma.portfolioImage.findFirst({ where: { albumId: img.albumId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { url: true } });
    await prisma.portfolioAlbum.update({ where: { id: img.albumId }, data: { coverUrl: next?.url ?? null } });
  }
  const row = await prisma.portfolioAlbum.findUniqueOrThrow({ where: { id: img.albumId }, select: { id: true, title: true, slug: true, category: true, description: true, coverUrl: true, isPublished: true, images: imageOrder } });
  refresh(slug, img.album.slug);
  return { success: true, data: { album: toDTO(row) } };
}

export async function setPortfolioCover(slug: string, imageId: string): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const img = await prisma.portfolioImage.findFirst({ where: { id: imageId, album: { storeId: a.store.id } }, select: { url: true, albumId: true, album: { select: { slug: true } } } });
  if (!img) return { success: false, error: "Photo not found." };
  await prisma.portfolioAlbum.update({ where: { id: img.albumId }, data: { coverUrl: img.url } });
  refresh(slug, img.album.slug);
  return { success: true, data: undefined };
}

export async function setPortfolioCaption(slug: string, imageId: string, caption: string): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const img = await prisma.portfolioImage.findFirst({ where: { id: imageId, album: { storeId: a.store.id } }, select: { id: true, album: { select: { slug: true } } } });
  if (!img) return { success: false, error: "Photo not found." };
  await prisma.portfolioImage.update({ where: { id: img.id }, data: { caption: cleanText(caption, 140) || null } });
  refresh(slug, img.album.slug);
  return { success: true, data: undefined };
}

/** Moves an album one place up or down in the order shown on the portfolio page. */
export async function movePortfolioAlbum(slug: string, id: string, direction: "up" | "down"): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const all = await prisma.portfolioAlbum.findMany({ where: { storeId: a.store.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((x) => x.id === id);
  if (i === -1) return { success: false, error: "Album not found." };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return { success: true, data: undefined };
  const ids = all.map((x) => x.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // Rewrite 0..n so ties from older rows can't leave the order ambiguous.
  await prisma.$transaction(ids.map((albumId, n) => prisma.portfolioAlbum.update({ where: { id: albumId }, data: { sortOrder: n } })));
  refresh(slug);
  return { success: true, data: undefined };
}
