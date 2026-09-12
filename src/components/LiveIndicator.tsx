import clsx from "clsx";
import { useLiveStatus } from "@/hooks/useLiveUpdates";

/**
 * The one persistent sign that the console is alive: a breathing teal dot
 * when the socket is connected, flat and dim while reconnecting, and a warm
 * pulse — the same gradient as an arriving row's glow — the instant an
 * activity lands, wherever in the app you're looking when it happens.
 */
export function LiveIndicator() {
  const { connected, lastArrivalName } = useLiveStatus();

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-semibold text-muted">
      <span
        aria-hidden="true"
        className={clsx(
          "size-1.5 flex-none rounded-full",
          lastArrivalName
            ? "animate-live-arrival-pulse bg-gradient-to-r from-warm-from to-warm-to"
            : connected
              ? "animate-live-pulse bg-accent"
              : "bg-faint",
        )}
      />
      <span>{connected ? "Live" : "Reconnecting…"}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {lastArrivalName ? `New activity arrived: ${lastArrivalName}` : ""}
      </span>
    </div>
  );
}
