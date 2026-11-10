"use client";

import { useState } from "react";

// Vercel rejects request bodies over ~4.5MB, and phone photos of IDs are often 4-12MB. So photos are
// shrunk in the browser first (IDs stay perfectly readable at 2200px) and only then sent.
const SEND_LIMIT = 4 * 1024 * 1024;

async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let best: Blob | null = null;
    for (const [maxSide, quality] of [[2200, 0.85], [1800, 0.8], [1400, 0.75], [1100, 0.7]] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      best = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (best && best.size <= SEND_LIMIT) break;
    }
    bitmap.close?.();
    if (!best || best.size >= file.size) return file;
    return new File([best], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. a browser that can't decode it: send as is and let the server decide
  }
}

export function FileUploadField({
  label,
  value,
  onChange,
  error,
  privateDoc = false,
  imageOnly = false,
  keepValueOnError = false,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  error?: string;
  /** KYC/ID documents: uploaded privately, so no thumbnail can be shown. */
  privateDoc?: boolean;
  /** Photos only: no PDFs. For image slots such as the hero and story picture. */
  imageOnly?: boolean;
  /** On a failed upload, keep the current value instead of clearing it (clearing would save an empty image). */
  keepValueOnError?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setUploadError(null);
    try {
      file = await shrinkImage(file);
      if (file.size > SEND_LIMIT) {
        throw new Error(file.type === "application/pdf" ? "This PDF is too big (4MB max). Take a clear photo of the document instead, or compress the PDF." : "This file is too big. Try a smaller photo.");
      }
      const formData = new FormData();
      formData.append("file", file);
      if (privateDoc) formData.append("purpose", "kyc");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 413) throw new Error("That file is too big. Try a smaller photo or a PDF under 4MB.");
        throw new Error(body?.error ?? `Upload failed (${res.status}). Check your connection and try again.`);
      }
      onChange(body.url);
    } catch (err) {
      if (!keepValueOnError) onChange("");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
      {value && !isUploading && !privateDoc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 h-20 w-20 rounded-md border object-cover" />
      )}
      {value && !isUploading && privateDoc && (
        <p className="mb-2 text-xs font-medium text-emerald-700">✓ Uploaded securely — only BizNest reviewers can view it.</p>
      )}
      <input
        type="file"
        accept={imageOnly ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="block w-full text-sm"
      />
      <p className="mt-1 text-xs text-muted-foreground">{imageOnly ? "JPG, PNG or WEBP — up to 10MB." : "JPG, PNG, WEBP, or PDF — up to 10MB."}</p>
      {isUploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
      {value && !isUploading && (
        <button type="button" onClick={() => onChange("")} className="mt-1 text-xs text-muted-foreground underline hover:text-foreground">
          Remove image
        </button>
      )}
      {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
