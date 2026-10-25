/** Pulsing BizNest logo with a ring: the app's loading indicator. */
export function LogoLoader({ size = 64, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <div className="bn-logo-loader" style={{ width: size, height: size }} role="status" aria-label={label}>
      <span className="bn-logo-loader-ring" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={size} height={size} className="bn-logo-loader-img" />
    </div>
  );
}
