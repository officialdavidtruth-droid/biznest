"use client";

import { useState } from "react";
import { FileUploadField } from "@/components/forms/file-upload-field";

/** Logo upload for the Business details form. Carries the uploaded URL into the <form> as a hidden input. */
export function BusinessLogoField({ initialLogo }: { initialLogo: string }) {
  const [logo, setLogo] = useState(initialLogo);
  return (
    <div>
      <input type="hidden" name="logoUrl" value={logo} />
      <FileUploadField label="Your logo" value={logo} onChange={setLogo} imageOnly keepValueOnError />
    </div>
  );
}
