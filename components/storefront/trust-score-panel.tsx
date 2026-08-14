import type { CSSProperties } from "react";
import type { TrustScoreChecklist } from "@/lib/actions/trust-score";

// Buyer-facing expansion of TrustBadge -- shows the "why" behind the number
// as a plain checklist, the way a customer weighing whether to trust an
// unfamiliar seller would want to see it.
//
// Every storefront template (see components/storefront/templates/*) themes
// itself with inline styles rather than Tailwind classes -- TrustBadge
// already follows that convention for the same reason, so this does too.
// Plain <details>/<summary> for the expand/collapse so no client component
// boundary is needed to drop this into a server-rendered template.

function scoreColor(score: number) {
  if (score >= 80) return "#0F9D58";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

export function TrustScorePanel({
  checklist,
  accent,
  borderColor,
  style,
}: {
  checklist: TrustScoreChecklist;
  /** Optional theme accent for the label text, matching TrustBadge's prop. */
  accent?: string;
  /** Optional override for the panel border; defaults to a tint of the score color. */
  borderColor?: string;
  style?: CSSProperties;
}) {
  const { score, items } = checklist;
  const color = scoreColor(score);
  const border = borderColor ?? `${color}33`;

  return (
    <details style={{ border: `1px solid ${border}`, borderRadius: 8, ...style }}>
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: accent ?? "inherit" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: `${color}1A`,
              color,
            }}
          >
            {score}/100
          </span>
          BizNest Trust Score
        </span>
        <span style={{ fontSize: 11, color: "#999" }}>▾</span>
      </summary>
      <ul
        style={{
          margin: 0,
          listStyle: "none",
          padding: "10px 12px",
          borderTop: `1px solid ${border}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 12,
        }}
      >
        {items.map((item) => (
          <li key={item.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                width: 14,
                height: 14,
                borderRadius: "50%",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                flexShrink: 0,
                background: item.met ? `${color}1A` : "#00000010",
                color: item.met ? color : "#00000040",
              }}
            >
              {item.met ? "✓" : "○"}
            </span>
            <span style={{ color: item.met ? "inherit" : "#888" }}>{item.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
