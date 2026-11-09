import localFont from "next/font/local";

/** Display face for the Browse pages (shop names, headings). Body text uses the app font. Bundled, not fetched from Google. */
export const browseDisplay = localFont({
  src: "../app/fonts/bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-browse-display",
});
