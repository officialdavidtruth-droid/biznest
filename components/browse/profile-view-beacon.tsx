"use client";

import { useEffect } from "react";
import { trackBrowse } from "@/components/browse/browse-track";

/** Counts one profile view for the store's Insights, once per page load. */
export function ProfileViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    trackBrowse({ kind: "PROFILE_VIEW", slug });
  }, [slug]);
  return null;
}
