"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

export function MultiImageUpload({
  value,
  onChange,
  max = 8,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
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
      onChange([...value, url]);
    } finally {
      setIsUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Product images</label>
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div key={url + i} className="group relative h-20 w-20 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/40">
            {isUploading ? (
              <span className="text-xs">…</span>
            ) : (
              <Plus className="h-5 w-5" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{value.length}/{max} images</p>
    </div>
  );
}
