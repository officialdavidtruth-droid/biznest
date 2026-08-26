// The actual "render this template with sample data" logic already exists
// in full at components/storefront/template-preview-page.tsx (mock catalog
// items, reviews, generateStaticParams, revalidate, metadata -- everything
// a real route needs). What was missing was this file: without a page.tsx
// under app/template-preview/[name]/, Next.js never registered the route at
// all, so every request to it -- including the <iframe src="/template-preview/...">
// thumbnails and the "Preview" modal in template-gallery.tsx -- 404'd.
//
// Same thin re-export convention already used elsewhere in this app, e.g.
// app/store/[slug]/account/orders/page.tsx.
export {
  default,
  generateStaticParams,
  revalidate,
  metadata,
} from "@/components/storefront/template-preview-page";
