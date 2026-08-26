/**
 * A single pulsing skeleton block ("brick"). Loading screens are built by
 * arranging these into the rough shape of the page underneath, so the
 * transition into the real content doesn't jump around once it arrives —
 * see app/store/[slug]/loading.tsx and app/store/[slug]/admin/loading.tsx,
 * the two spots this was requested for (storefront + store admin nav is
 * where clicking between pages has a noticeable gap while the server
 * component fetches).
 */
export function SkeletonBrick({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-foreground/10 ${className}`}
      style={style}
    />
  );
}
