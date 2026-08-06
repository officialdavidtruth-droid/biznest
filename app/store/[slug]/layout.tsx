// Lumina design system typefaces — headlines in Plus Jakarta Sans, body/UI
// in Inter (see lib/template-themes.ts LUMINA.font / LUMINA.headlineFont).
// Next.js hoists <link> tags found anywhere in the tree into <head>, so
// declaring them once here covers every storefront page under /store/[slug]
// (home, cart, checkout) without each page re-declaring it.
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
