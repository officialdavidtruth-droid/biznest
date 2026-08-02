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

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onChange(url);
    } catch {
      // Surfacing errors here rather than a toast keeps this component
      // self-contained and reusable outside form contexts.
      onChange("");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="block w-full text-sm"
      />
      {isUploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
      {value && !isUploading && <p className="mt-1 truncate text-xs text-green-600">Uploaded ✓</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
