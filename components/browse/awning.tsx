/** A scalloped shop awning. Decorative: it marks "this is a shop" on profiles and empty states. */
export function Awning({ className = "", height = 34, a = "#F5B82E", b = "#FBF6E9" }: { className?: string; height?: number; a?: string; b?: string }) {
  const r = height * 0.41;
  const stripe = r * 2;
  const top = height - r;
  return (
    <svg aria-hidden="true" focusable="false" className={`block w-full ${className}`} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bn-awning" patternUnits="userSpaceOnUse" width={stripe * 2} height={height}>
          <rect x="0" y="0" width={stripe} height={top} fill={a} />
          <path d={`M0 ${top} a${r} ${r} 0 0 0 ${stripe} 0Z`} fill={a} />
          <rect x={stripe} y="0" width={stripe} height={top} fill={b} />
          <path d={`M${stripe} ${top} a${r} ${r} 0 0 0 ${stripe} 0Z`} fill={b} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill="url(#bn-awning)" />
    </svg>
  );
}
