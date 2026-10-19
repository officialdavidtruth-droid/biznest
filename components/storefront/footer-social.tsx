import { Instagram, Facebook, Twitter, MessageCircle } from "lucide-react";
import type { CSSProperties } from "react";

// Shared, data-driven social links for template footers. Templates used to
// hardcode decorative icons ("f ◎ ♥ ▶") that linked nowhere and ignored what
// the store owner configured in settings. This renders only the networks the
// store actually has, each linking to the owner's URL/number.
type Social = Record<string, string | null | undefined> | null | undefined;

const BASES: Record<string, string> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  twitter: "https://x.com/",
  tiktok: "https://tiktok.com/@",
};

export function socialHref(key: string, raw: string): string {
  const v = raw.trim();
  if (key === "whatsapp") return /^https?:/i.test(v) ? v : `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  if (/^https?:\/\//i.test(v)) return v;
  return `${BASES[key] ?? "https://"}${v.replace(/^@/, "")}`;
}

export function FooterSocial({
  social,
  className,
  style,
  iconSize = 16,
}: {
  social: Social;
  className?: string;
  style?: CSSProperties;
  iconSize?: number;
}) {
  const s = social ?? {};
  const items = (["instagram", "facebook", "twitter", "tiktok", "whatsapp"] as const)
    .filter((k) => typeof s[k] === "string" && (s[k] as string).trim())
    .map((k) => ({ key: k, href: socialHref(k, s[k] as string) }));
  if (!items.length) return null;
  const icon = (k: string) =>
    k === "instagram" ? <Instagram size={iconSize} /> :
    k === "facebook" ? <Facebook size={iconSize} /> :
    k === "twitter" ? <Twitter size={iconSize} /> :
    k === "whatsapp" ? <MessageCircle size={iconSize} /> :
    <span style={{ fontSize: iconSize - 3, fontWeight: 700 }}>TT</span>;
  const label = (k: string) => (k === "tiktok" ? "TikTok" : k === "twitter" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1));
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 12, ...style }}>
      {items.map((i) => (
        <a key={i.key} href={i.href} target="_blank" rel="noopener noreferrer" aria-label={label(i.key)} style={{ color: "inherit", display: "inline-flex" }}>
          {icon(i.key)}
        </a>
      ))}
    </span>
  );
}
