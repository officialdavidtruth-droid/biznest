"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import {
  EMPTY_HOSPITALITY_GALLERY,
  type GalleryAlbum,
  type GalleryImage,
  type HospitalityGalleryContent,
} from "@/lib/actions/hospitality-content.types";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export type { GalleryAlbum, GalleryImage, HospitalityGalleryContent } from "@/lib/actions/hospitality-content.types";

// Gallery & Stories lives under the website builder area ("settings"
// permission in dashboard-nav.ts).
async function access(slug: string) {
  return assertStorePermission(slug, "settings");
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
          
