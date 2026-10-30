/**
 * Accent colors are brand colors and often too light to read as small text
 * (yellow, gold, lime on white). Fills keep the real accent; use this for
 * accent-colored TEXT so it stays at least 4.5:1 against the surface it sits on.
 * Returns the accent unchanged when it already reads, otherwise the nearest
 * darker (light surface) or lighter (dark surface) shade of the same color.
 */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (c: [number, number, number]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function readableAccentText(accent: string, surface: string, min = 4.5): string {
  if (!HEX.test(accent) || !HEX.test(surface)) return accent;
  const a = rgb(accent);
  const s = rgb(surface);
  if (contrast(a, s) >= min) return accent;
  // Move toward black on light surfaces, toward white on dark ones.
  const target = luminance(s) > 0.4 ? 0 : 255;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = a.map((v) => v + (target - v) * t) as [number, number, number];
    if (contrast(c, s) >= min) return toHex(c);
  }
  return toHex([target, target, target]);
}
