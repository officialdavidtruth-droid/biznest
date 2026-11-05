import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Default social-share card (1200x630) for the platform homepage and any page that
// doesn't provide its own image. Shown in WhatsApp, Facebook, X and LinkedIn previews.
export const alt = "BizNest: your online store, bookings and payments in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#0f6410";
const DEEP = "#0a1c12";
const CREAM = "#f6f3ea";

function logoDataUri() {
  try {
    return `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "icon-512.png")).toString("base64")}`;
  } catch {
    return null;
  }
}

const row = { display: "flex", alignItems: "center" } as const;

export default function OpengraphImage() {
  const logo = logoDataUri();
  const chip = (label: string, bg: string, fg: string) => (
    <div style={{ display: "flex", background: bg, color: fg, fontSize: 24, fontWeight: 700, padding: "10px 22px", borderRadius: 999 }}>{label}</div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: DEEP, position: "relative" }}>
        {/* soft brand glow behind the mockup */}
        <div style={{ position: "absolute", right: -140, top: -160, width: 640, height: 640, borderRadius: 640, background: "#d9ead3", display: "flex" }} />

        {/* left: message */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 700, padding: "0 0 0 72px" }}>
          <div style={{ ...row, gap: 16 }}>
            {logo ? <img src={logo} width={64} height={64} style={{ borderRadius: 16 }} alt="" /> : <div style={{ width: 64, height: 64, borderRadius: 16, background: GREEN, display: "flex" }} />}
            <div style={{ fontSize: 40, fontWeight: 800, color: GREEN }}>BizNest</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, fontSize: 82, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>Your business,</div>
            <div style={{ display: "flex", color: GREEN }}>online today.</div>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 32, lineHeight: 1.35, color: "#3d5244", maxWidth: 600 }}>
            Sell, take bookings and get paid.
          </div>
          <div style={{ ...row, gap: 12, marginTop: 38 }}>
            {chip("Online store", GREEN, CREAM)}
            {chip("Bookings", DEEP, CREAM)}
            {chip("Payments", "#ffffff", DEEP)}
          </div>
        </div>

        {/* right: storefront mockup */}
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", right: 64, top: 70, width: 360, height: 490, background: "#ffffff", borderRadius: 36, border: `10px solid ${DEEP}`, overflow: "hidden" }}>
          <div style={{ display: "flex", height: 120, background: GREEN, padding: "18px 24px", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", color: CREAM, fontSize: 28, fontWeight: 800 }}>Ada&apos;s Closet</div>
            <div style={{ display: "flex", color: "#bfe0b8", fontSize: 18 }}>biznest.space</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: 18, gap: 12 }}>
            {[["Ankara dress", "NGN 18,500"], ["Leather sandals", "NGN 12,000"]].map(([n, p]) => (
              <div key={n} style={{ ...row, gap: 14, background: "#f3f6f1", borderRadius: 18, padding: 12 }}>
                <div style={{ width: 62, height: 62, borderRadius: 14, background: "#cfe5c8", display: "flex" }} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>{n}</div>
                  <div style={{ display: "flex", fontSize: 22, color: GREEN, fontWeight: 800 }}>{p}</div>
                </div>
              </div>
            ))}
            <div style={{ ...row, justifyContent: "center", background: GREEN, color: CREAM, borderRadius: 18, padding: "16px 0", fontSize: 24, fontWeight: 800 }}>Pay securely</div>
            <div style={{ ...row, justifyContent: "center", gap: 8, color: GREEN, fontSize: 20, fontWeight: 700 }}>
              <div style={{ width: 14, height: 14, borderRadius: 14, background: GREEN, display: "flex" }} />
              Payment received
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
