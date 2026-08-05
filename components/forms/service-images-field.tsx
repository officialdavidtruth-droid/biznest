"use client";

import { useState } from "react";
import { MultiImageUpload } from "./multi-image-upload";

export function ServiceImagesField() {
  const [images, setImages] = useState<string[]>([]);
  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <MultiImageUpload value={images} onChange={setImages} max={6} label="Service images" />
    </div>
  );
}
