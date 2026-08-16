"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Thin wrapper around a plain <input type="password">, so it still works
// directly with react-hook-form's {...register(...)} spread (ref included)
// — the eyeball toggle just flips the input's `type` between "password"
// and "text" client-side, nothing else changes about how the field behaves.
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`w-full rounded-md border px-3 py-2 pr-10 text-sm ${className}`}
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
