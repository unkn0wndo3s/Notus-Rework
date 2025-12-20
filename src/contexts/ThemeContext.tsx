"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { DEFAULT_COLOR } from "@/lib/colorPalette";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  primaryColor: string;
  setPrimaryColor: (hexColor: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isDark, setIsDark] = useState(false);
  const [primaryColor, setPrimaryColor] = useState<string>("");

  useEffect(() => {
    // Check system preference on load
    const isSystemDark = globalThis.window.matchMedia("(prefers-color-scheme: dark)").matches;
    const hasManualOverride = localStorage.getItem("theme");
    
    if (hasManualOverride) {
      const manualTheme = localStorage.getItem("theme") === "dark";
      setIsDark(manualTheme);
      if (manualTheme) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Use system preference
      setIsDark(isSystemDark);
      if (isSystemDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    // Listen to system preference changes only if no manual override
    const mediaQuery = globalThis.window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        if (e.matches) {
          document.documentElement.classList.add("dark");
          setIsDark(true);
        } else {
          document.documentElement.classList.remove("dark");
          setIsDark(false);
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Applies the primary color to relevant CSS variables
  const applyPrimaryColor = (hexColor: string) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", hexColor);
    root.style.setProperty("--accent", hexColor);
    root.style.setProperty("--ring", hexColor);
    root.style.setProperty("--sidebar-primary", hexColor);
  };

  // Load saved primary color
  useEffect(() => {
    const saved = localStorage.getItem("primaryColor");
    if (saved && /^#([0-9a-fA-F]{6})$/.test(saved)) {
      setPrimaryColor(saved);
      applyPrimaryColor(saved);
    } else {
      // Use default color from palette
      setPrimaryColor(DEFAULT_COLOR);
      applyPrimaryColor(DEFAULT_COLOR);
    }
  }, []);

  const updatePrimaryColor = useCallback((hexColor: string) => {
    setPrimaryColor(hexColor);
    localStorage.setItem("primaryColor", hexColor);
    applyPrimaryColor(hexColor);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      localStorage.setItem("theme", newIsDark ? "dark" : "light");
      if (newIsDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return newIsDark;
    });
  }, []);

  const value = useMemo(() => ({
    isDark,
    toggleTheme,
    primaryColor,
    setPrimaryColor: updatePrimaryColor,
  }), [isDark, toggleTheme, primaryColor, updatePrimaryColor]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
