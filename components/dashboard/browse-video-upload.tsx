"use client";

import { useRef, useState } from "react";
import { Film, X } from "lucide-react";
import { BROWSE_VIDEO_MAX_SECONDS, videoErrorFor } from "@/lib/browse-video";

function readSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

/** Picks a video, checks it, and uploads it straight to Cloudinary (which shrinks it to 720p as it arrives). Calls onChange with the stored URL. */
export function BrowseVideoUpload({ slug, value, onChange, unlimited }: { slug: string; value: string | null; onChange: (url: string | null) => void; unlimited: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function pick(file: File) {
    setError("");
    const problem = videoErrorFor(file, await readSeconds(file), unlimited);
    if (problem) { setError(problem); return; }
    try {
      setProgress(0);
      const signRes = await fetch("/api/browse/video-sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, contentType: file.type, size: file.size }) });
      const sign = await signRes.json().catch(() => null);
      if (!signRes.ok || !sign?.signature) throw new Error(sign?.error ?? "Couldn't start the upload. Try again.");
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sign.apiKey);
      form.append("signature", sign.signature);
      for (const [k, v] of Object.entries(sign.params)) form.append(k, String(v));
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
        xhr.onload = () => {
          try {
            const r = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) resolve(r.secure_url);
            else reject(new Error(r?.error?.message ?? "Upload failed. Try again."));
          } catch { reject(new Error("Upload failed. Try again.")); }
        };
        xhr.send(form);
      });
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs">Video (optional){unlimited ? " · no length limit" : ` · up to ${BROWSE_VIDEO_MAX_SECONDS} seconds`}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <video src={value} className="h-20 w-16 rounded-md bg-black object-cover" muted playsInline preload="metadata" />
          <span className="text-xs text-emerald-700">Video ready. It will be the cover of your post.</span>
          <button type="button" className="ml-auto rounded-md p-1.5 hover:bg-muted" aria-label="Remove video" onClick={() => onChange(null)}><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" disabled={progress !== null} onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm hover:bg-muted disabled:opacity-60">
          <Film className="h-4 w-4" aria-hidden />
          {progress !== null ? `Uploading… ${progress}%` : "Add a video"}
        </button>
      )}
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
