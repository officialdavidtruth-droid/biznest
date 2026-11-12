import { NextResponse } from "next/server";

// Sends the visitor to the newest desktop installer.
//
// The installers are built by .github/workflows/build-desktop.yml and published as assets of the
// "desktop-latest" release. The repo is private, so the asset URLs are not public: this route asks
// GitHub (with a read-only token kept in GITHUB_RELEASE_TOKEN) for a short-lived signed download link
// and redirects to it. The token never reaches the browser, and the installer is not streamed through
// this function, so there is no size limit.
export const dynamic = "force-dynamic";

const FILES: Record<string, string> = {
  windows: "BizNest-Setup.exe",
  mac: "BizNest.dmg",
  linux: "BizNest.AppImage",
};
const REPO = process.env.GITHUB_RELEASE_REPO || "officialdavidtruth-droid/biznest";

export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const file = FILES[platform];
  if (!file) return NextResponse.json({ error: "Unknown platform." }, { status: 404 });

  const token = process.env.GITHUB_RELEASE_TOKEN;
  if (!token) return NextResponse.json({ error: "The desktop installer is not published yet." }, { status: 503 });

  const gh = (url: string, accept: string, init?: RequestInit) =>
    fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28" } });

  try {
    const rel = await gh(`https://api.github.com/repos/${REPO}/releases/tags/desktop-latest`, "application/vnd.github+json", { cache: "no-store" });
    if (!rel.ok) return NextResponse.json({ error: "The desktop installer is not published yet." }, { status: 503 });
    const data = (await rel.json()) as { assets?: { id: number; name: string }[] };
    const asset = data.assets?.find((a) => a.name === file);
    if (!asset) return NextResponse.json({ error: "That installer is not available yet." }, { status: 404 });

    const dl = await gh(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, "application/octet-stream", { redirect: "manual" });
    const location = dl.headers.get("location");
    if (!location) return NextResponse.json({ error: "Could not start the download." }, { status: 502 });
    return NextResponse.redirect(location, 302);
  } catch {
    return NextResponse.json({ error: "Could not reach the download server. Try again in a moment." }, { status: 502 });
  }
}
