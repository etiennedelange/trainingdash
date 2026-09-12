import { ApiError } from "@/lib/api";

/**
 * Distinguishes "you've never connected Strava" (401) from a genuine fetch
 * failure — both used to render identically as "Could not load activities.",
 * which left the athlete guessing and put the only fix (Connect Strava) in
 * the sidebar footer, disconnected from the error itself.
 */
export function DataError({
  error,
  onRetry,
  subject,
}: {
  error: unknown;
  onRetry: () => void;
  subject: string;
}) {
  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="p-10">
        <p className="text-sm text-muted">Connect your Strava account to see your {subject}.</p>
        <a
          href="/auth/login"
          className="mt-4 inline-block rounded-[var(--radius-nav)] px-4 py-2.5 text-sm font-bold text-on-accent"
          style={{ background: "var(--color-accent)" }}
        >
          Connect Strava
        </a>
      </div>
    );
  }

  return (
    <div className="p-10">
      <p className="text-sm text-muted">Couldn't load {subject} — check your connection and try again.</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-[var(--radius-control)] border border-line px-4 py-2 text-sm font-bold text-muted hover:border-muted"
      >
        Retry
      </button>
    </div>
  );
}
