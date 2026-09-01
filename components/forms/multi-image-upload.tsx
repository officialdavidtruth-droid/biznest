"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

export function MultiImageUpload({
  value,
  onChange,
  max = 8,
  label = "Product images",
  tileSize = "sm",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  // "lg" is used by the redesigned catalog item form (bigger tiles, 4-up
  // grid, no "Main Image" ribbon) -- "sm" keeps every other existing caller
  // (e.g. service-images-field.tsx) pixel-identical to before.
  tileSize?: "sm" | "lg";
}) {
  const [isUploading, setIsUploading] = useState(false);
  const isLg = tileSize === "lg";

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      onChange([...value, body.url]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
      <div className={isLg ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "flex flex-wrap gap-3"}>
        {value.map((url, i) => (
          <div
            key={url + i}
            className={
              isLg
                ? "group relative aspect-square overflow-hidden rounded-xl border"
                : "group relative h-20 w-20 overflow-hidden rounded-md border"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {!isLg && i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[9px] font-medium text-white">Main Image</span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove image"
              className={
                isLg
                  ? "absolute right-2 top-2 rounded-full bg-white/90 p-1 text-foreground shadow transition hover:bg-white"
                  : "absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              }
            >
              <X className={isLg ? "h-3.5 w-3.5" : "h-3 w-3"} />
            </button>
          </div>
        ))}

        {value.length < max && (
          <label
            className={
              isLg
                ? "flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/40"
                : "flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/40"
            }
          >
            {isUploading ? (
              <span className="text-xs">Uploading…</span>
            ) : isLg ? (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-current">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-center text-xs font-medium leading-tight">
                  Add Image
                  <br />
                  <span className="text-[10px] font-normal opacity-70">JPG, PNG up to 5MB</span>
                </span>
              </>
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
