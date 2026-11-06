import { Bricolage_Grotesque } from "next/font/google";

/** Display face for the Browse pages (shop names, headings). Body text uses the app font. */
export const browseDisplay = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", variable: "--font-browse-display", weight: ["600", "700", "800"] });
