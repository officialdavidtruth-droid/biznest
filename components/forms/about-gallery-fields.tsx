"use client";

import { useState } from "react";
import { FileUploadField } from "./file-upload-field";
import { MultiImageUpload } from "./multi-image-upload";

/**
 * The Fresh & Co.-style storefront template has a few spots that used to
 * just be decorative color tiles (the "About" story panel, a team/work
 * photo strip). This makes those real, vendor-uploaded images instead —
 * same client-carries-state-into-server-form pattern as LogoBannerFields.
 */
export function AboutGalleryFields({
  initialAboutImage,
  initialGallery,
}: {
  initialAboutImage: string;
  initialGallery: string[];
}) {
  const [aboutImage, setAboutImage] = useState(initialAboutImage);
  const [gallery, setGallery] = useState(initialGallery);

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-3 text-sm font-medium">Storefront photos</p>
      <input type="hidden" name="aboutImage" value={aboutImage} />
      <input type="hidden" name="galleryImages" value={JSON.stringify(gallery)} />

      <FileUploadField label="About section image" value={aboutImage} onChange={setAboutImage} />
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Shown next to your About text — a photo of your team, space, or work in progress.
      </p>

      <MultiImageUpload label="Photo gallery" value={gallery} onChange={setGallery} max={8} />
      <p className="mt-1 text-xs text-muted-foreground">
        A photo strip shown on your storefront (team, past jobs, your space). Leave empty to hide it.
      </p>
    </div>
  );
}
