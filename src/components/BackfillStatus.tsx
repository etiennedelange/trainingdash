/**
 * The one sign that the first-run import is alive: while the background
 * backfill has not finished, this shows the count the client has seen so far
 * (which grows as it refetches). A steady breathing accent dot mirrors the
 * live socket's language — the import, too, is something happening right now.
 */
export function BackfillStatus({
  count,
  error,
}: {
  count: number;
  error: string | null;
}) {
  return (
    <div className="mt-6 flex items-center gap-2.5 rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-surface)]">
      <span aria-hidden="true" className="size-1.5 flex-none animate-live-pulse rounded-full bg-accent" />
      <p role="status" aria-live="polite" className="text-xs font-semibold text-muted">
        {`Importing your history… ${count} activities so far`}
        {error ? ` · ${error}` : ""}
      </p>
    </div>
  );
}