import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { DEFAULT_PAGE_SKIN, RADIUS_PX, TITLE_TRACK, TITLE_WEIGHT } from "@/lib/storefront/page-skin";
import type { StorePalette } from "@/lib/store-palette-defaults";

const STEP_LABELS = ["Cart", "Details", "Payment"];

/** The step indicator, drawn in whichever of five styles the template's skin picks. `current` is 0-2. */
export function PageSteps({ palette, current }: { palette: StorePalette; current: number }) {
  const skin = palette.skin ?? DEFAULT_PAGE_SKIN;
  const { ink, accent, onAccent } = palette;
  const r = RADIUS_PX[skin.radius];
  if (skin.steps === "none") return null;
  if (skin.steps === "bar") {
    return (
      <div className="w-64 max-w-full" aria-label="Checkout steps">
        <div style={{ background: `${ink}1a`, borderRadius: 999 }} className="h-1.5 w-full overflow-hidden">
          <div style={{ background: accent, width: `${((current + 1) / 3) * 100}%` }} className="h-full" />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-medium">
          {STEP_LABELS.map((l, i) => <span key={l} style={{ opacity: i <= current ? 1 : 0.5 }}>{l}</span>)}
        </div>
      </div>
    );
  }
  if (skin.steps === "tabs") {
    return (
      <ol className="flex gap-1 text-xs font-semibold" aria-label="Checkout steps">
        {STEP_LABELS.map((l, i) => (
          <li key={l} style={{ background: i === current ? accent : `${ink}0d`, color: i === current ? onAccent : ink, borderRadius: skin.radius === "sharp" ? 0 : r === "28px" ? 999 : 8, opacity: i > current ? 0.6 : 1 }} className="px-3 py-1.5">{l}</li>
        ))}
      </ol>
    );
  }
  if (skin.steps === "crumbs") {
    return (
      <p className="text-xs" aria-label="Checkout steps">
        {STEP_LABELS.map((l, i) => (
          <span key={l}>
            <span style={{ fontWeight: i === current ? 700 : 400, opacity: i === current ? 1 : 0.55, textDecoration: i === current ? `underline ${accent} 2px` : "none", textUnderlineOffset: 4 }}>{l}</span>
            {i < 2 && <span style={{ opacity: 0.35 }} className="mx-2">/</span>}
          </span>
        ))}
      </p>
    );
  }
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Checkout steps">
      {STEP_LABELS.map((l, i) => (
        <li key={l} className="flex items-center gap-2" style={{ opacity: i <= current ? 1 : 0.55 }}>
          <span style={{ background: i <= current ? accent : "transparent", color: i <= current ? onAccent : ink, border: `1.5px solid ${i <= current ? accent : `${ink}55`}` }} className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]">{i + 1}</span>
          <span>{l}</span>
          {i < 2 && <span style={{ background: `${ink}33` }} className="mx-1 h-px w-6" />}
        </li>
      ))}
    </ol>
  );
}

/** Page title block for cart, checkout and payment. Layout, weight and step style all come from the template's skin. */
export function PageHeading({ palette, title, subtitle, current, before }: { palette: StorePalette; title: string; subtitle?: ReactNode; current: number; before?: ReactNode }) {
  const skin = palette.skin ?? DEFAULT_PAGE_SKIN;
  const h1 = (
    <h1 style={{ fontFamily: palette.headlineFont, letterSpacing: TITLE_TRACK[skin.weight] }} className={`text-3xl sm:text-4xl ${TITLE_WEIGHT[skin.weight]}`}>{title}</h1>
  );
  const sub = subtitle ? <p style={{ opacity: 0.65 }} className="mt-1.5 text-sm">{subtitle}</p> : null;
  const steps = <PageSteps palette={palette} current={current} />;
  switch (skin.header) {
    case "centre":
      return <div className="mb-10 flex flex-col items-center gap-3 text-center">{before}{h1}{sub}<div className="mt-2">{steps}</div></div>;
    case "band":
      return (
        <div className="mb-8">
          {before}
          <div style={{ background: palette.accent, color: palette.onAccent, borderRadius: RADIUS_PX[skin.radius] }} className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-8">
            <div>{h1}{sub}</div>
            <div style={{ filter: palette.onAccent.toLowerCase() === "#ffffff" ? "none" : "none" }} className="[&_*]:!border-current [&_li]:!bg-transparent [&_li]:!text-current">{steps}</div>
          </div>
        </div>
      );
    case "split":
      return (
        <div className="mb-8">
          {before}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>{h1}{sub}</div>
            <div className="flex flex-col items-end gap-3">
              <span style={{ opacity: 0.6 }} className="flex items-center gap-1.5 text-xs font-medium"><Lock className="h-3.5 w-3.5" /> Secure and encrypted</span>
              {steps}
            </div>
          </div>
        </div>
      );
    case "plain":
      return <div className="mb-10 pt-4">{before}{h1}{sub}<div className="mt-4">{steps}</div></div>;
    default:
      return (
        <div className="mb-8">
          {before}
          <div style={{ borderBottom: `1px solid ${palette.ink}1a` }} className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
            <div>{h1}{sub}</div>
            {steps}
          </div>
        </div>
      );
  }
}
