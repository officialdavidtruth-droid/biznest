import manifest from "./template-thumbnails.generated.json";

type Entry = { file: string; hash: string };

/**
 * Gallery cover for a template, or null until scripts/generate-template-thumbnails.ts has produced one.
 *
 * The images live under /template-reference-previews/generated/ on purpose: that folder is already excluded
 * from the middleware matcher and listed in RESERVED_SLUGS, so no routing change is needed. The manifest is
 * written by the generator and carries a content hash, which is appended as ?v= so a regenerated image is
 * never served stale from a browser or CDN cache.
 */
export function getTemplateThumbnail(name: string): string | null {
  const entry = (manifest.items as Record<string, Entry | undefined>)[name];
  return entry ? `${entry.file}?v=${entry.hash.slice(0, 8)}` : null;
}
