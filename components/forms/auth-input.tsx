"use client";

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";

export const AuthInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }
>(({ icon: Icon, className = "", ...props }, ref) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
    <input
      ref={ref}
      className={`w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-3.5 text-sm text-[var(--bn-ink)] shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/50 focus:border-transparent focus:ring-2 focus:ring-[var(--bn-marigold)] ${className}`}
      {...props}
    />
  </div>
));
AuthInput.displayName = "AuthInput";
