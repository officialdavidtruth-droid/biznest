import localFont from "next/font/local";

/**
 * Fonts are bundled with the app (app/fonts, SIL Open Font License) instead of being fetched from Google
 * Fonts during the build, so a deploy can never fail because Google Fonts was unreachable.
 */
export const spaceGrotesk = localFont({
  src: [
    { path: "../app/fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const inter = localFont({
  src: "../app/fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
});

export const jetBrainsMono = localFont({
  src: "../app/fonts/jetbrains-mono-latin-500-normal.woff2",
  weight: "500",
  variable: "--font-mono",
  display: "swap",
});
