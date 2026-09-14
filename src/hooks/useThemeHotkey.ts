import { useEffect } from "react";
import { useTheme } from "./useTheme";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Cmd/Ctrl+Shift+D toggles the theme from anywhere in the app. Ignores
 * inputs, textareas, selects, and contenteditable nodes so it never fires
 * mid-typing (e.g. while composing a Coach question).
 */
export function useThemeHotkey() {
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const isToggle = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d";
      if (!isToggle) return;
      e.preventDefault();
      setTheme(theme === "light" ? "dark" : "light");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, setTheme]);
}
