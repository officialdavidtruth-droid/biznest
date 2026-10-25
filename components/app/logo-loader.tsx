/**
 * Animated BizNest logo: the app's loading indicator.
 * A comet ring orbits the logo while it breathes, a light sweep glides across
 * it, and a soft glow + pulse ring radiate outward. All CSS (see globals.css,
 * `.bn-logo-loader-*`), respects prefers-reduced-motion.
 */
export function LogoLoader({ size = 64, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <div className="bn-logo-loader" style={{ width: size, height: size }} role="status" aria-label={label}>
      <span className="bn-logo-loader-glow" aria-hidden="true" />
      <span className="bn-logo-loader-orbit" aria-hidden="true" />
      <span className="bn-logo-loader-dot" aria-hidden="true" />
      <span className="bn-logo-loader-ring" aria-hidden="true" />
      <span className="bn-logo-loader-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={size} height={size} className="bn-logo-loader-img" />
        <span className="bn-logo-loader-shine" aria-hidden="true" />
      </span>
    </div>
  );
}
