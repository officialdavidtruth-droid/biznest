/**
 * Line-art "nest": woven rings that draw themselves in, then drift slowly, with a few small eggs resting inside.
 * Pure SVG + CSS, decorative only (hidden from screen readers), no images to download.
 */
export function NestGraphic({ className = "" }: { className?: string }) {
  const rings = [
    { rx: 150, ry: 54, rot: -8, w: 1.6, o: 0.9 },
    { rx: 138, ry: 48, rot: 6, w: 1.2, o: 0.7 },
    { rx: 126, ry: 44, rot: -22, w: 1.2, o: 0.55 },
    { rx: 112, ry: 38, rot: 18, w: 1, o: 0.45 },
    { rx: 96, ry: 32, rot: -4, w: 1, o: 0.35 },
  ];
  return (
    <svg className={`bn-nest ${className}`.trim()} viewBox="-190 -120 380 240" fill="none" aria-hidden="true" focusable="false">
      <g className="bn-nest-drift">
        {rings.map((r, i) => (
          <ellipse
            key={i}
            className="bn-nest-ring"
            cx="0"
            cy="0"
            rx={r.rx}
            ry={r.ry}
            transform={`rotate(${r.rot})`}
            stroke="var(--bn-accent-text)"
            strokeWidth={r.w}
            strokeOpacity={r.o}
            strokeLinecap="round"
            pathLength={1}
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </g>
      <g className="bn-nest-eggs">
        <ellipse className="bn-nest-egg" cx="-26" cy="-6" rx="13" ry="17" fill="var(--bn-accent-text)" fillOpacity="0.16" stroke="var(--bn-accent-text)" strokeOpacity="0.7" style={{ animationDelay: "0ms" }} />
        <ellipse className="bn-nest-egg" cx="6" cy="-2" rx="12" ry="16" fill="var(--bn-accent-text)" fillOpacity="0.1" stroke="var(--bn-accent-text)" strokeOpacity="0.55" style={{ animationDelay: "500ms" }} />
        <ellipse className="bn-nest-egg" cx="34" cy="-8" rx="11" ry="15" fill="var(--bn-accent-text)" fillOpacity="0.2" stroke="var(--bn-accent-text)" strokeOpacity="0.8" style={{ animationDelay: "1000ms" }} />
      </g>
    </svg>
  );
}
