"use client";

import { useState } from "react";
import { MultiImageUpload } from "./multi-image-upload";

export function ServiceImagesField({ initialImages = [] }: { initialImages?: string[] }) {
  const [images, setImages] = useState<string[]>(initialImages);
  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <MultiImageUpload value={images} onChange={setImages} max={6} label="Service images" />
    </div>
  );
}
