"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className={className}>
      Sign out
    </button>
  );
}
