"use client";

/**
 * BizNest no longer ships a light/dark toggle — the entire product runs on
 * a single green + white brand palette. This file is kept as a thin,
 * inert wrapper (rather than deleted outright) so every existing call
 * site — app/store/[slug]/admin/layout.tsx, app/supaadmin/layout.tsx —
 * keeps compiling without touching their flex-layout structure.
 *
 * `scopeId` still gets applied to the wrapping div because a couple of
 * layouts depend on it being a flex container, but there is no more
 * "dark" class, no localStorage read/write, and no system-theme listener.
 */
export function ThemeProvider({
  children,
  scopeId,
}: {
  children: React.ReactNode;
  /** @deprecated no longer used — BizNest has one fixed theme now. */
  defaultTheme?: "light" | "dark" | "system";
  scopeId: string;
}) {
  return (
    <div id={scopeId} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}

/**
 * @deprecated Theme switching was removed. Kept only so any lingering
 * import doesn't crash the build; always resolves to the single light
 * theme and setTheme is a no-op.
 */
export function useTheme() {
  return {
    theme: "light" as const,
    resolvedTheme: "light" as const,
    setTheme: (_next: "light" | "dark" | "system") => {},
  };
}

/**
 * @deprecated No-op. There is nothing to flash-guard against anymore
 * since the app never switches themes.
 */
export function ThemeFlashGuard(_props: { scopeId: string; defaultTheme?: "light" | "dark" | "system" }) {
  return null;
}
