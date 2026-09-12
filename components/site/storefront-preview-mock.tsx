const MOCK_PRODUCTS = [
  { name: "Woven tote bag", price: "₦18,500" },
  { name: "Ankara wrap dress", price: "₦32,000" },
  { name: "Beaded earrings", price: "₦6,200" },
];

// A hand-built, static mock of a generated storefront, dressed as a browser
// window. Every element here is CSS/markup, not a screenshot, so it's
// exact, license-free, and always in sync with the brand.
export function StorefrontPreviewMock() {
  return (
    <div
      className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
      style={{ border: "1px solid var(--bn-ink-line)", background: "var(--bn-ink-raised)" }}
    >
      {/* browser chrome */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--bn-ink-line)" }}
      >
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e2645a" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e6b34f" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#34d399" }} />
        </div>
        <div
          className="flex-1 truncate rounded-full px-3 py-1 text-center text-[11px]"
          style={{ background: "var(--bn-ink)", color: "var(--bn-mute)", fontFamily: "var(--font-mono)" }}
        >
          biznest.space/stacey
        </div>
      </div>

      {/* mock storefront */}
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: "var(--bn-ivory)", fontFamily: "var(--font-display)" }}>
            Stacey&apos;s Paradise
          </span>
          <div className="flex gap-2">
            {["Shop", "About", "Contact"].map((l) => (
              <span key={l} className="hidden text-[11px] sm:inline" style={{ color: "var(--bn-mute)" }}>
                {l}
              </span>
            ))}
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ink)" }}
            >
              Cart · 2
            </span>
          </div>
        </div>

        <div
          className="mb-4 flex h-28 flex-col justify-center rounded-xl px-5 sm:h-32"
          style={{
            background:
              "radial-gradient(120% 140% at 15% 20%, rgba(52,211,153,0.35) 0%, transparent 60%), linear-gradient(135deg, #123024 0%, #0a1c12 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--bn-marigold)", fontFamily: "var(--font-mono)" }}>
            New season
          </p>
          <p className="mt-1 text-lg font-semibold sm:text-xl" style={{ color: "var(--bn-ivory)", fontFamily: "var(--font-display)" }}>
            Fabric that tells a story
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {MOCK_PRODUCTS.map((p, i) => (
            <div key={p.name}>
              <div
                className="aspect-square rounded-lg"
                style={{
                  background: `linear-gradient(${135 + i * 40}deg, rgba(52,211,153,0.28), rgba(16,150,122,0.18))`,
                  border: "1px solid var(--bn-ink-line)",
                }}
              />
              <p className="mt-1.5 truncate text-[11px] font-medium" style={{ color: "var(--bn-ivory)" }}>
                {p.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--bn-mute)", fontFamily: "var(--font-mono)" }}>
                {p.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
