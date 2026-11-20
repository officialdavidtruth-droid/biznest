"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Light / dark switch for the merchant dashboard (and super-admin).
 *
 * The choice lives in localStorage ("bn-admin-theme") and is applied as two classes on <html>:
 * `bn-admin-dark` (our dashboard overrides in app/globals.css) and `dark` (Tailwind's dark: variants).
 * The classes are removed again when the dashboard unmounts, so storefronts and marketing pages never go dark.
 */
export type AdminTheme = "light" | "dark";
const KEY = "bn-admin-theme";
const EVENT = "bn-admin-theme-change";

function read(): AdminTheme {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function apply(theme: AdminTheme) {
  const el = document.documentElement;
  el.classList.toggle("bn-admin-dark", theme === "dark");
  el.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const theme = useSyncExternalStore<AdminTheme>(subscribe, read, () => "light");
  const setTheme = (next: AdminTheme | "system") => {
    const value: AdminTheme = next === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* private mode: the choice just won't persist */
    }
    apply(value);
    window.dispatchEvent(new Event(EVENT));
  };
  return { theme, resolvedTheme: theme, setTheme };
}

export function ThemeProvider({
  children,
  scopeId,
}: {
  children: React.ReactNode;
  scopeId: string;
  defaultTheme?: "light" | "dark" | "system";
}) {
  const { theme } = useTheme();
  useEffect(() => {
    apply(theme);
    return () => {
      document.documentElement.classList.remove("bn-admin-dark", "dark");
    };
  }, [theme]);

  return (
    <div id={scopeId} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}

/** Sets the saved theme before first paint so a dark dashboard never flashes white. */
export function ThemeFlashGuard(_props: { scopeId: string; defaultTheme?: "light" | "dark" | "system" }) {
  const code = `try{if(localStorage.getItem("${KEY}")==="dark"){var e=document.documentElement;e.classList.add("bn-admin-dark","dark")}}catch(_){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
