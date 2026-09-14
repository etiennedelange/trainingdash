import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { meQuery } from "@/lib/queries";

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

  const logout = useMutation({
    mutationFn: async () => {
      const res = await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!res.ok) throw new Error(`Logout failed (${res.status})`);
    },
    onSuccess: async () => {
      // Clearing the whole cache (not just `me`/`activities`) means every
      // route reacts, not only whichever one happens to read those two
      // queries — the previous targeted removeQueries left routes like
      // /progress or /coach showing no change until an unrelated navigation.
      queryClient.clear();
      await navigate({ to: "/" });
    },
  });

  // The main content area already carries the one, centered "Connect
  // Strava" CTA (via DataError) whenever a page's data is unavailable — the
  // sidebar footer shows a quiet status line instead of a second copy of it.
  if (isError || !data) return null;

  if (!data.connected) {
    return (
      <p className="px-3 text-xs text-muted">No data yet — connect Strava to get started.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="w-full rounded-[var(--radius-nav)] px-3 py-2.5 text-left text-sm font-bold text-muted transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
      >
        {logout.isPending ? "Logging out…" : "Log out"}
      </button>
      {logout.isError ? (
        <p role="alert" className="px-3 text-xs text-danger">
          Couldn't log out. Try again.
        </p>
      ) : null}
    </div>
  );
}
