/**
 * The one loading treatment for every route: a mono readout instead of prose,
 * so the "waiting" moment still reads as the instrument booting up rather
 * than a generic spinner borrowed from any other dashboard.
 */
export function LoadingState() {
  return (
    <p className="p-10 font-mono text-xs tracking-wide text-faint uppercase">
      Reading telemetry
      <span className="animate-live-pulse">…</span>
    </p>
  );
}
