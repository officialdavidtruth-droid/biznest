import { shrinkImage } from "@/components/forms/multi-image-upload";

export async function uploadBrowseImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", await shrinkImage(file));
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? (res.status === 413 ? "That photo is too large. Try a smaller one." : `Photo upload failed (error ${res.status}).`));
  return body.url as string;
}

/** Direct browser-to-Cloudinary upload. Cloudinary trims, shrinks to 720p and discards the original as the file arrives. */
export async function uploadBrowseVideo(slug: string, file: File, trim: { start: number; end: number } | null, onProgress: (pct: number) => void): Promise<string> {
  const signRes = await fetch("/api/browse/video-sign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, contentType: file.type, size: file.size, ...(trim ? { start: trim.start, end: trim.end } : {}) }),
  });
  const sign = await signRes.json().catch(() => null);
  if (!signRes.ok || !sign?.signature) throw new Error(sign?.error ?? "Couldn't start the upload. Try again.");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("signature", sign.signature);
  for (const [k, v] of Object.entries(sign.params)) form.append(k, String(v));
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) resolve(r.secure_url);
        else reject(new Error(r?.error?.message ?? "Video upload failed. Try again."));
      } catch { reject(new Error("Video upload failed. Try again.")); }
    };
    xhr.send(form);
  });
}
