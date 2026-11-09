/**
 * Bridges to the BizNest Android app (Capacitor). Every function falls back cleanly in a normal browser,
 * so the website works the same with or without the app.
 */
type Cap = { isNativePlatform?: () => boolean; Plugins?: Record<string, any> };
const cap = (): Cap | null => (typeof window === "undefined" ? null : ((window as unknown as { Capacitor?: Cap }).Capacitor ?? null));

export function isNativeApp(): boolean {
  try { return !!cap()?.isNativePlatform?.(); } catch { return false; }
}

/**
 * Opens the phone's own photo and video gallery (it asks for permission the first time).
 * Returns null when not in the app, when the app has not been updated, or when something fails,
 * so the caller can fall back to the normal file input. An empty array means the user cancelled.
 */
export async function pickNativeMedia(limit: number): Promise<File[] | null> {
  const plugin = cap()?.Plugins?.FilePicker;
  if (!isNativeApp() || !plugin?.pickMedia) return null;
  try {
    const res = await plugin.pickMedia({ limit });
    const out: File[] = [];
    for (const f of (res?.files ?? []) as Array<{ name: string; mimeType: string; webPath?: string; blob?: Blob }>) {
      const blob = f.blob ?? (f.webPath ? await (await fetch(f.webPath)).blob() : null);
      if (blob) out.push(new File([blob], f.name || "media", { type: f.mimeType || blob.type }));
    }
    return out;
  } catch (e) {
    // The picker reports a cancel as an error.
    if (/cancel/i.test(String((e as { message?: string })?.message ?? e))) return [];
    return null;
  }
}

/** Opens the phone's share sheet. Returns false when not in the app so the caller can use the web share. */
export async function nativeShare(opts: { title?: string; text?: string; url: string }): Promise<boolean> {
  const plugin = cap()?.Plugins?.Share;
  if (!isNativeApp() || !plugin?.share) return false;
  try { await plugin.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: "Share" }); return true; }
  catch (e) { return /cancel/i.test(String((e as { message?: string })?.message ?? e)); }
}

/** A light tap on supported phones, used for likes and posting. Never throws. */
export function haptic(): void {
  try { void cap()?.Plugins?.Haptics?.impact?.({ style: "LIGHT" }); } catch { /* not available */ }
}
