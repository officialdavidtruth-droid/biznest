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

