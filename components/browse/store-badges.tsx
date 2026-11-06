import { BadgeCheck, Crown } from "lucide-react";

/**
 * The two marks next to a business name: the blue check (verified by BizNest) and,
 * for businesses on the Business Mogul plan, a gold crown. A business can have either or both.
 */
export function StoreBadges({ verified, mogul, dark = false, size = "sm" }: { verified?: boolean; mogul?: boolean; dark?: boolean; size?: "sm" | "lg" }) {
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
