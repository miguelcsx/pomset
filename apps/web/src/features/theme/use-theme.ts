"use client";

/**
 * The appearance shared by the workbench and the account pages. Dark is the
 * default, as the workbench has always been. The choice is kept in this
 * browser, and it is read after mount so the server render and the first
 * browser render agree.
 */

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pomset-theme";

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = readSaved();
    if (saved) setThemeState(saved);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage is unavailable, so the choice lasts only until the page reloads.
    }
  }, []);

  return [theme, setTheme];
}

function readSaved(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}
