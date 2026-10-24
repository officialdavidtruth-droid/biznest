import { ImageResponse } from "next/og";

// Default social-share card (1200x630) for the platform homepage and any page
// that doesn't provide its own image. Generated at build time -- no asset needed.
export const alt = "BizNest — Build, Sell, Grow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0a1c12 0%, #0f6410 100%)",
          color: "#f6f3ea",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.9 }}>BizNest</div>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>Build, Sell, Grow.</div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85, maxWidth: 900 }}>
          Open your online store, take bookings and get paid — all in one place.
        </div>
      </div>
    ),
    size
  );
}
