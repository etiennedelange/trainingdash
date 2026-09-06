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
        className="block rounded-[11px] px-3 py-2.5 text-center text-sm font-bold text-ground"
        style={{ background: "var(--color-accent)" }}
      >
        Connect Strava
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
      className="w-full rounded-[11px] px-3 py-2.5 text-left text-sm font-bold text-muted hover:bg-raised"
    >
      Log out
    </button>
  );
}
