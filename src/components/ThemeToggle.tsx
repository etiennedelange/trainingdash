import clsx from "clsx";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle({ variant = "row" }: { variant?: "row" | "icon" }) {
  const [theme, setTheme] = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Dark mode" : "Light mode";

  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-pressed={isLight}
      aria-label={variant === "icon" ? label : undefined}
      title={variant === "icon" ? label : undefined}
      className={clsx(
        "flex flex-none items-center rounded-[var(--radius-control)] text-muted transition-colors",
        variant === "icon"
          ? "size-9 items-center justify-center border border-line bg-card shadow-2xl hover:bg-raised"
          : "w-full gap-2.5 rounded-[var(--radius-nav)] px-3 py-2.5 text-left text-sm font-bold hover:bg-raised",
      )}
    >
      {isLight ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {variant === "row" ? label : null}
    </button>
  );
}
