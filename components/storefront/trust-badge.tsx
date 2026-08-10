import type { CSSProperties } from "react";

// Compact "BizNest Trust Score" badge for storefront pages. Unlike
// TrustScoreCard (dashboard, full breakdown), this is a single inline
// element meant to sit next to the existing star-rating line in any of
// the 11 storefront templates. Templates here use inline styles rather
// than Tailwind, so this accepts a plain `accent` color instead of a
// className, matching how each template already themes its own bits.
//
// `score` is nullable because trust-score.ts only has something to
// compute once a store has an associated `business` row — during early
// onboarding a store can exist without one yet.

function scoreColor(score: number) {
  if (score >= 80) return "#0F9D58"; // emerald
  if (score >= 60) return "#2563EB"; // blue
  if (score >= 40) return "#D97706"; // amber
  return "#DC2626"; // red
}

export function TrustBadge({
  score,
  accent,
  size = "md",
  style,
}: {
  score: number | null;
  /** Optional theme accent to tint the label text; the score pill keeps its own semantic color. */
  accent?: string;
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  if (score == null) return null;
  const color = scoreColor(score);
  const fontSize = size === "sm" ? 10 : 12;
  const pad = size === "sm" ? "1px 6px" : "2px 8px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize,
        fontWeight: 700,
        color: accent ?? "inherit",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: pad,
          borderRadius: 999,
          background: `${color}1A`,
          color,
          fontWeight: 800,
        }}
      >
        {score} Trust Score
      </span>
    </span>
  );
}
