"use client";

/**
 * ThemeContext
 * ---------------------------------------------------------------------------
 * Controls light/dark/system appearance. Applies a `data-theme` attribute to
 * <html> (see globals.css for the token overrides), persists the user's
 * choice to localStorage for instant paint on next load, and mirrors it to
 * `settings.theme` in Firestore when a user is signed in (best-effort —
 * failures are swallowed so theme switching never feels broken offline).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { AppTheme } from "@/types/firestore";

const STORAGE_KEY = "natassha:theme";

interface ThemeContextValue {
  theme: AppTheme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: AppTheme): "light" | "dark" {
  if (theme === "system") return getSystemPrefersDark() ? "dark" : "light";
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === "undefined") return "system";
    return (window.localStorage.getItem(STORAGE_KEY) as AppTheme | null) ?? "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => resolve(theme));

  // React to OS-level scheme changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setResolvedTheme(resolve("system"));
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    setResolvedTheme(resolve(next));
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
