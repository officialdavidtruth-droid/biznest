import { BadgeCheck, Crown, ShieldCheck } from "lucide-react";

/**
 * The marks next to a business name: the blue check (verified by BizNest) and, for businesses on the
 * Business Mogul plan, a gold crown. BizNest's own account gets a single mark of its own, a gold-edged
 * green "Official" seal, which stands in for the others so nothing else on Browse can look like it.
 */
export function StoreBadges({ verified, mogul, official = false, dark = false, size = "sm" }: { verified?: boolean; mogul?: boolean; official?: boolean; dark?: boolean; size?: "sm" | "lg" }) {
  if (official) {
    const lg = size === "lg";
    return (
      <span
        role="img" aria-label="Official BizNest account" title="Official BizNest account"
        className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-br from-[#1E5B32] to-[#0F3A1E] font-bold text-[#FFE08A] ring-2 ring-[#F5B82E] shadow-[0_0_0_3px_rgba(245,184,46,.18)] ${lg ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px] leading-4"}`}
      >
        <ShieldCheck className={lg ? "h-4 w-4" : "h-3 w-3"} aria-hidden /> Official
      </span>
    );
  }
  if (!verified && !mogul) return null;
  const icon = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  const crown = size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {verified && <BadgeCheck className={`${icon} shrink-0 ${dark ? "text-sky-400" : "text-sky-600"}`} aria-label="Verified business" />}
      {mogul && (
        <span role="img" aria-label="Business Mogul" title="Business Mogul" className={`${crown} inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FFE08A] to-[#E8A317] text-[#4a3000] ring-1 ring-[#b87b00]/50`}>
          <Crown className={size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} aria-hidden />
        </span>
      )}
    </span>
  );
}
