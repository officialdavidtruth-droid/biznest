// eslint-disable-next-line @next/next/no-img-element
// (plain <img>, not next/image — logoUrl can be any external host the
// merchant uploaded to, and this renders in a fixed small tile where
// next/image's optimization overhead isn't worth the extra config)
export function StoreLogo({
  logoUrl,
  storeName,
  size = "md",
}: {
  logoUrl?: string | null;
  storeName: string;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={storeName}
        className={`${dims} shrink-0 object-cover shadow-sm ring-1 ring-border`}
      />
    );
  }
  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground shadow-sm ring-1 ring-primary/20`}
    >
      {storeName.charAt(0).toUpperCase()}
    </div>
  );
}
