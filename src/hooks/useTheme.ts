import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "trainingdash-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * The `<html data-theme>` attribute (flipped by ThemeToggle) is the single
 * source of truth so every tab stays in sync; this just mirrors it into
 * React state via a MutationObserver so components can re-render (and
 * re-read CSS vars for canvas/WebGL surfaces that don't get them for free).
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / disabled storage — the toggle still works for this tab.
    }
    setThemeState(next);
  }

  return [theme, setTheme];
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
