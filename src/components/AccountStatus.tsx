import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { meQuery, queryKeys } from "@/lib/queries";

/**
 * The Worker refuses a second Strava athlete and never exposes a signup
 * flow — this app has exactly one account. So "logged out" here just means
 * "no valid session cookie yet," and the only actions are connect or clear
 * the cookie, not switch users.
 */
export function AccountStatus() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isError } = useQuery(meQuery);

  if (!isError && !data) return null;

  if (isError || !data.connected) {
    return (
      <a
        href="/auth/login"
        className="flex items-center justify-center gap-1.5 rounded-[var(--radius-nav)] px-3 py-2.5 text-center text-sm font-bold text-on-accent"
        style={{ background: "var(--color-accent)" }}
      >
        Connect Strava
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 17 17 7M9 7h8v8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    );
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    queryClient.removeQueries({ queryKey: queryKeys.me });
    queryClient.removeQueries({ queryKey: queryKeys.activities });
    await navigate({ to: "/" });
  }

  return (
    <button
      onClick={() => void logout()}
      className="w-full rounded-[var(--radius-nav)] px-3 py-2.5 text-left text-sm font-bold text-muted hover:bg-raised"
    >
      Log out
    </button>
  );
}
