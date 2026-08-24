import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "noteflow_theme_preference";

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    return saved === "dark" || saved === "system" ? saved : "light"; // Default is Light
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    let targetTheme: ResolvedTheme = "light";

    if (mode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      targetTheme = prefersDark ? "dark" : "light";
    } else {
      targetTheme = mode;
    }

    setResolvedTheme(targetTheme);

    if (targetTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }
  }, []);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      if (typeof window !== "undefined") {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
      applyTheme(mode);
    },
    [applyTheme]
  );

  // Apply on mount and listen to system preference changes
  useEffect(() => {
    applyTheme(themeMode);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode, applyTheme]);

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    isDark: resolvedTheme === "dark",
  };
}
