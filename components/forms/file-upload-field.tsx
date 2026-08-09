"use client";

import { useState } from "react";

export function FileUploadField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  error?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error ?? `Upload failed (${res.status})`);
      }
      onChange(body.url);
    } catch (err) {
      onChange("");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
      {value && !isUploading && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 h-20 w-20 rounded-md border object-cover" />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="block w-full text-sm"
      />
      <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP, or PDF — up to 10MB.</p>
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
