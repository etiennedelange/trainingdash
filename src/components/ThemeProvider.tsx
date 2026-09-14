import type { ReactNode } from "react";
import { useThemeHotkey } from "@/hooks/useThemeHotkey";

/**
 * Mounted near the app root so every route shares one Cmd/Ctrl+Shift+D theme
 * shortcut. `data-theme` on <html> stays the single source of theme state
 * (see useTheme) — this owns only the hotkey wiring.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useThemeHotkey();
  return children;
}
