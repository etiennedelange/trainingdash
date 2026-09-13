import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityRow, ActivitySummary, LiveMessage } from "#shared/types";
import { meQuery, queryKeys } from "@/lib/queries";

const MAX_BACKOFF = 30_000;

// How long an activity stays flagged as "just arrived" — long enough to
// register as an event, short enough that it never reads as a permanent state.
const ARRIVAL_TTL = 2_600;

/**
 * Holds the live socket. The socket is an optimisation, never the source of
 * truth: every path here ends in invalidating the activities cache, so a
 * dropped connection or a missed event self-corrects on the next refetch.
 */
export function useLiveUpdates(): {
  connected: boolean;
  authenticated: boolean;
  arrivedIds: Set<number>;
  lastArrivalName: string | null;
  heroArrival: ActivityRow | null;
  dismissHero: () => void;
} {
  const queryClient = useQueryClient();
  // /live always 401s pre-login, so there is no point opening (and
  // endlessly retrying) the socket until a session exists — this also
  // stops the indicator from reading "Reconnecting…" while logged out.
  const { isSuccess: authenticated } = useQuery(meQuery);
  const [connected, setConnected] = useState(false);
  const [arrivedIds, setArrivedIds] = useState<Set<number>>(() => new Set());
  const [lastArrivalName, setLastArrivalName] = useState<string | null>(null);
  // Unlike arrivedIds/lastArrivalName (which expire after ARRIVAL_TTL to drive
  // the row-level glow), this persists until the athlete dismisses it or
  // leaves the page — it backs the Today page's result hero, not a toast. It
  // holds the full socket-payload row so the hero renders the instant the
  // message arrives, without waiting on the refetch that keeps the cache honest.
  const [heroArrival, setHeroArrival] = useState<ActivityRow | null>(null);
  const dismissHero = () => setHeroArrival(null);

  useEffect(() => {
    if (!authenticated) {
      setConnected(false);
      return;
    }

    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;
    let disposed = false;

    const refetch = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${proto}//${window.location.host}/live`);

      socket.onopen = () => {
        backoff = 1000;
        setConnected(true);
        // Close whatever gap the disconnection opened.
        refetch();
      };

      socket.onmessage = (event) => {
        let msg: LiveMessage;
        try {
          msg = JSON.parse(String(event.data)) as LiveMessage;
        } catch {
          return;
        }
        if (msg.type === "activity.upsert") {
          const id = msg.activity.id;
          setArrivedIds((prev) => new Set(prev).add(id));
          setLastArrivalName(msg.activity.name);
          setHeroArrival(msg.activity);
          setTimeout(() => {
            if (disposed) return;
            setArrivedIds((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setLastArrivalName(null);
          }, ARRIVAL_TTL);
        }
        if (msg.type === "activity.upsert" || msg.type === "activity.delete") {
          refetch();
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (disposed) return;
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient, authenticated]);

  return { connected, authenticated, arrivedIds, lastArrivalName, heroArrival, dismissHero };
}

const LiveArrivalsContext = createContext<Set<number>>(new Set());
const LiveStatusContext = createContext<{
  connected: boolean;
  authenticated: boolean;
  lastArrivalName: string | null;
}>({
  connected: false,
  authenticated: false,
  lastArrivalName: null,
});
export const HeroArrivalContext = createContext<{
  activity: ActivitySummary | null;
  dismiss: () => void;
}>({
  activity: null,
  dismiss: () => {},
});

/**
 * Runs the live socket once at the app shell and republishes connection
 * status plus which activity ids just arrived, so any component in the tree
 * — nav badge, row glow, or a persistent shell indicator — can react without
 * every route re-deriving its own socket connection.
 */
export function LiveArrivalsProvider({ children }: { children: ReactNode }) {
  const { connected, authenticated, arrivedIds, lastArrivalName, heroArrival, dismissHero } =
    useLiveUpdates();
  return createElement(
    LiveStatusContext.Provider,
    { value: { connected, authenticated, lastArrivalName } },
    createElement(
      LiveArrivalsContext.Provider,
      { value: arrivedIds },
      createElement(
        HeroArrivalContext.Provider,
        { value: { activity: heroArrival, dismiss: dismissHero } },
        children,
      ),
    ),
  );
}

export function useJustArrived(activityId: number): boolean {
  return useContext(LiveArrivalsContext).has(activityId);
}

/** Whether any activity is currently flagged "just arrived," for a nav-level cue. */
export function useHasLiveArrival(): boolean {
  return useContext(LiveArrivalsContext).size > 0;
}

/** Live-socket connection state, whether a session exists at all, and the
 *  name of the most recently arrived activity, if any. */
export function useLiveStatus(): {
  connected: boolean;
  authenticated: boolean;
  lastArrivalName: string | null;
} {
  return useContext(LiveStatusContext);
}

/** The activity backing the Today page's result hero, if any, and a way to dismiss it. */
export function useHeroArrival(): { activity: ActivitySummary | null; dismiss: () => void } {
  return useContext(HeroArrivalContext);
}
