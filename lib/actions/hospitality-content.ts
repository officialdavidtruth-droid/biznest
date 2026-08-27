"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

export type GalleryImage = {
  id: string;
  image: string;
  title: string;
  caption?: string;
  description?: string;
  featured?: boolean;
};

export type GalleryAlbum = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  images: GalleryImage[];
};

export type HospitalityGalleryContent = {
  type: "hospitality-gallery";
  eyebrow: string;
  title: string;
  intro: string;
  albums: GalleryAlbum[];
};

export const EMPTY_HOSPITALITY_GALLERY: HospitalityGalleryContent = {
  type: "hospitality-gallery",
  eyebrow: "Visual narrative",
  title: "See the place before you arrive.",
  intro: "Tell the story of your property through photographs, moments and spaces.",
  albums: [],
};

async function access(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };
  const allowed = store.business.userId === session.user.id || session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!allowed) return { success: false as const, error: "You don't have access to this store." };
  return { success: true as const, store };
}

function cleanString(value: unknown, max = 10000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeContent(value: unknown): HospitalityGalleryContent {
  if (!value || typeof value !== "object") return EMPTY_HOSPITALITY_GALLERY;
  const raw = value as Record<string, unknown>;
  const albums = Array.isArray(raw.albums) ? raw.albums : [];
  return {
    type: "hospitality-gallery",
    eyebrow: cleanString(raw.eyebrow, 120) || EMPTY_HOSPITALITY_GALLERY.eyebrow,
    title: cleanString(raw.title, 180) || EMPTY_HOSPITALITY_GALLERY.title,
    intro: cleanString(raw.intro, 1200) || EMPTY_HOSPITALITY_GALLERY.intro,
    albums: albums.map((album) => {
      const a = album && typeof album === "object" ? album as Record<string, unknown> : {};
      const images = Array.isArray(a.images) ? a.images : [];
      return {
        id: cleanString(a.id, 80) || crypto.randomUUID(),
        title: cleanString(a.title, 160) || "Untitled collection",
        description: cleanString(a.description, 1000),
        coverImage: cleanString(a.coverImage, 2000),
        images: images.map((item) => {
          const i = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: cleanString(i.id, 80) || crypto.randomUUID(),
            image: cleanString(i.image, 2000),
            title: cleanString(i.title, 160) || "Untitled image",
            caption: cleanString(i.caption, 300),
            description: cleanString(i.description, 1000),
            featured: Boolean(i.featured),
          };
        }).filter((i) => i.image),
      };
    }),
  };
}

export async function getHospitalityGallery(slug: string): Promise<HospitalityGalleryContent> {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return EMPTY_HOSPITALITY_GALLERY;
  const page = await prisma.storePage.findUnique({ where: { storeId_slug: { storeId: store.id, slug: "gallery" } } });
  return normalizeContent(page?.content);
}

export async function saveHospitalityGallery(slug: string, content: HospitalityGalleryContent): Promise<ActionResult> {
  const result = await access(slug);
  if (!result.success) return result;
  const safe = normalizeContent(content);
  await prisma.storePage.upsert({
    where: { storeId_slug: { storeId: result.store.id, slug: "gallery" } },
    update: { title: "Gallery", content: safe, isPublished: true },
    create: { storeId: result.store.id, slug: "gallery", title: "Gallery", content: safe, isPublished: true },
  });
  revalidatePath(`/${slug}/hotel/gallery`);
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/admin/gallery`);
  return { success: true, data: undefined };
}
