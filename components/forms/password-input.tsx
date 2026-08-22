"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

// Thin wrapper around a plain <input type="password">, so it still works
// directly with react-hook-form's {...register(...)} spread (ref included)
// — the eyeball toggle just flips the input's `type` between "password"
// and "text" client-side, nothing else changes about how the field behaves.
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--bn-ink)] shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/50 focus:border-transparent focus:ring-2 focus:ring-[var(--bn-marigold)] ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
