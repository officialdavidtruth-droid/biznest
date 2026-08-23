export type PageContent = { body: string };

// The starter set offered in the "Pages" panel — matches the copy that used
// to sit in the placeholder ("About, Gallery, FAQ, Blog, Contact, Policies").
// A vendor can also add a custom one with any slug.
export const SUGGESTED_PAGE_SLUGS = ["about", "gallery", "faq", "blog", "contact", "policies"] as const;
export const SUGGESTED_PAGE_TITLES: Record<string, string> = {
  about: "About",
  gallery: "Gallery",
  faq: "FAQ",
  blog: "Blog",
  contact: "Contact",
  policies: "Policies",
};
