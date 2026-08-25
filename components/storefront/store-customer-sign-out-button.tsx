"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreCustomerSignOutButton({
  storeSlug,
  className,
  children,
}: {
  storeSlug: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/store-auth", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.replace(`/${encodeURIComponent(storeSlug)}`);
      router.refresh();
    }
  }

  return (
    <button type="button" disabled={pending} onClick={handleSignOut} className={className}>
      {children ?? "Sign out"}
    </button>
  );
}
