import { isSafeImageUrl } from "@/lib/builder-safe";

/**
 * How the owner's plain-text page content (Customize > Pages) is read on the storefront.
 * Pure functions, safe to import from client components.
 */

/**
 * Gallery body: a line that is an image URL becomes a photo (optional caption after " | ");
 * every other line is intro text shown above the photos.
 */
export function parseGalleryBody(body: string): { intro: string; images: { url: string; caption: string }[] } {
  const intro: string[] = [];
  const images: { url: string; caption: string }[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { intro.push(""); continue; }
    const [first, ...rest] = line.split("|");
    const url = first.trim();
    if (/^(https?:\/\/|\/(?!\/))\S+$/i.test(url) && isSafeImageUrl(url)) images.push({ url, caption: rest.join("|").trim() });
    else intro.push(line);
  }
  return { intro: intro.join("\n").replace(/\n{3,}/g, "\n\n").trim(), images: images.slice(0, 48) };
}

/**
 * Blog body: posts are separated by a line containing only "---". The first line of a post is its title and the
 * rest is its text (blank lines inside a post stay paragraph breaks). With no separator the whole body is one post.
 */
export function parseBlogPosts(body: string): { title: string; text: string }[] {
  return body
    .split(/^\s*-{3,}\s*$/m)
    .map((block) => block.trim().split(/\r?\n/))
    .map(([title, ...rest]) => ({ title: (title ?? "").trim(), text: rest.join("\n").trim() }))
    .filter((p) => p.title)
    .slice(0, 30);
}

/** What each page expects in its Content box, shown as a hint in the editor. */
export const PAGE_FORMAT_HINTS: Record<string, string> = {
  about: "Your story. Replaces the default text on your About page.",
  contact: "Opening hours, directions or a short note. Shown above your contact form.",
  gallery: "Paste one image URL per line (add a caption after a | if you like). Any other lines become intro text.",
  blog: "First line is a post title, the rest is the post. Put --- on its own line between posts.",
  faq: "Leave a blank line between questions. First line is the question, the rest is the answer.",
  policies: "Your terms, privacy or refund policy, in your own words.",
};
