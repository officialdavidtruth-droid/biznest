"use client";

import { useState } from "react";
import { FileUploadField } from "./file-upload-field";

/**
 * Settings' form is otherwise plain server-rendered HTML (native inputs,
 * no client JS) — this is the one part that needs client state, since
 * FileUploadField manages an async upload. Carries its result back into
 * the surrounding <form action={...}> via hidden inputs, so the rest of
 * the form doesn't need to become a client component.
 */
export function LogoBannerFields({ initialLogo, initialBanner }: { initialLogo: string; initialBanner: string }) {
  const [logo, setLogo] = useState(initialLogo);
  const [banner, setBanner] = useState(initialBanner);

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-3 text-sm font-medium">Branding</p>
      <input type="hidden" name="logoUrl" value={logo} />
      <input type="hidden" name="bannerUrl" value={banner} />
      <FileUploadField label="Store logo" value={logo} onChange={setLogo} />
      <div className="mt-4">
        <FileUploadField label="Storefront banner" value={banner} onChange={setBanner} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Used across your storefront hero, the template gallery, and anywhere else your store
        shows up. Uploading here always takes priority over the template's default look.
      </p>
    </div>
  );
}
