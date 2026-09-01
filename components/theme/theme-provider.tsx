"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "bn-theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Scoped theme provider for the merchant/platform dashboards — NOT the
 * marketing site or storefronts, which intentionally stay on their own
 * fixed palettes (marketing = dark forest brand look, storefront = each
 * vendor's own template). Wrap a surface's root element (see
 * app/store/[slug]/admin/layout.tsx, app/supaadmin/layout.tsx) with this
 * provider and toggle via useTheme()/<ThemeToggle />.
 *
 * Persists to localStorage so a merchant's choice survives across visits.
 * `defaultTheme` lets each surface pick its own fallback before the user
 * has ever chosen (both dashboards default to "dark" to match today's
 * look, so this ships with zero visual change until someone toggles it).
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  scopeId,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  scopeId: string;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    defaultTheme === "system" ? "dark" : (defaultTheme as ResolvedTheme)
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);

    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(getSystemTheme());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {/* suppressHydrationWarning: server always renders defaultTheme;
          the inline script below (rendered by the layout, before this
          component's HTML) overwrites the class pre-paint so there's no
          visible flash, then this component's own state/effects take
          over for the rest of the session (toggling, system-theme
          changes) without touching the DOM class directly again except
          through this same className render. */}
      {/* h-full is load-bearing, not cosmetic: every admin/supaadmin surface
          wrapped in this provider builds a fixed-height app-shell (sidebar +
          main each with their own overflow-y-auto) that relies on a percentage
          height (h-full) chain all the way up. Without h-full here, this div's
          height collapses to auto (fits its content), which breaks that chain
          at this exact link -- every descendant h-full silently stops meaning
          anything, the "constrained" panels grow to fit their content instead
          of scrolling internally, and the whole document scrolls instead. */}
      <div id={scopeId} className={`h-full ${resolvedTheme}`} suppressHydrationWarning>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/**
 * Inline, blocking script — render this as a sibling BEFORE <ThemeProvider>
 * in the layout (same scopeId) so the correct class lands on the DOM before
 * first paint, avoiding a light->dark (or dark->light) flash on reload.
 * Safe to inline: reads only localStorage, touches only this one element's
 * classList, and matches the client media query ThemeProvider itself uses.
 */
export function ThemeFlashGuard({ scopeId, defaultTheme = "dark" }: { scopeId: string; defaultTheme?: Theme }) {
  const script = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var resolved=(t==="light"||t==="dark")?t:((t===null||t==="system")?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"${defaultTheme}");var el=document.getElementById("${scopeId}");if(el){el.classList.remove("light","dark");el.classList.add(resolved);}}catch(e){}})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}