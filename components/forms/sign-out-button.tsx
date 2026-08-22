"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({
  className,
  callbackUrl = "/",
  children,
}: {
  className?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <button onClick={() => signOut({ callbackUrl })} className={className}>
      {children ?? "Sign out"}
    </button>
  );
}
